import {
  TAX_RATE,
  type EnrichedCarryInPosition,
  type EnrichedCorporateAction,
  type EnrichedTrade,
  type TaxPeriod,
  type TradeResult,
} from '../types.js';
import {
  actionTargets,
  assignAccounts,
  createSplitDeduper,
  decideJoins,
  type ComponentStats,
  createComponents,
  instrumentBase,
  instrumentGroup,
  instrumentNames,
  isTransfer,
  transferAccounts,
  UNASSIGNED_ACCOUNT,
  queueKey,
} from './accounts.js';
import {
  applyMerger,
  applyStockSplit,
  type FifoLot,
} from './corporate-actions.js';
import { incentiveExtraCost, isIncentiveBuy } from './incentive.js';
import { isInTaxPeriod } from './period.js';
import { shortfallWarnings, type ShortfallRequest } from './shortfall.js';
import { moveLots, transferDestKey, transferSourceKeys } from './transfers.js';

export { UNASSIGNED_ACCOUNT } from './accounts.js';

export interface CalculateCapitalGainsArgs {
  trades: EnrichedTrade[];
  corporateActions: EnrichedCorporateAction[];
  carryInPositions: EnrichedCarryInPosition[];
  taxPeriod: TaxPeriod;
  symbolCountryMap?: Map<string, string>;
  /** Receives non-fatal carry-in reconciliation warnings. */
  onWarning?: (warning: CarryInWarning) => void;
}

/** Non-fatal carry-in reconciliation findings. */
export type CarryInWarning =
  | {
      /** Imported trades explain part of the snapshot; only the rest is seeded. */
      kind: 'carry-in-overlap';
      symbol: string;
      isin?: string;
      year: number;
      carryInQuantity: number;
      coveredQuantity: number;
      account?: string;
    }
  | {
      /**
       * Imported history implies more shares at the end of `year` than the
       * snapshot; nothing is seeded.
       */
      kind: 'carry-in-inconsistent';
      symbol: string;
      isin?: string;
      year: number;
      carryInQuantity: number;
      impliedQuantity: number;
      account?: string;
    }
  | {
      /**
       * A row with a cost was only partly seeded; its cost was pro-rated per
       * share.
       */
      kind: 'carry-in-cost-prorated';
      symbol: string;
      isin?: string;
      year: number;
      carryInQuantity: number;
      seededQuantity: number;
      account?: string;
    }
  | {
      /**
       * Rows without an account were put into the `unassigned` account because
       * the session has several accounts. `overlap`: the instrument is also
       * held in an assigned account, so FIFO may be wrong (drafts the form).
       */
      kind: 'account-unassigned';
      symbol: string;
      isin?: string;
      overlap: boolean;
    }
  | {
      /**
       * Rows without an account were joined to `account`: the instrument ran
       * short otherwise and that account resolves it. Informational.
       */
      kind: 'account-assumed';
      symbol: string;
      isin?: string;
      account: string;
      rows: number;
    }
  | {
      /**
       * A sell exceeded the shares held in its account while another account
       * held the instrument: the shares were probably transferred. Nothing is
       * moved automatically; the missing shares have cost 0.
       */
      kind: 'transfer-suggested';
      instrument: string;
      isin?: string;
      fromAccount: string;
      toAccount: string;
      quantity: number;
      before: Date;
    }
  | {
      /**
       * A sell exceeded the shares held in its account and no other account
       * holds the instrument: a carry-in is missing. The missing shares have
       * cost 0.
       */
      kind: 'shortfall-add-carry-in';
      instrument: string;
      isin?: string;
      account: string;
      quantity: number;
      before: Date;
    }
  | {
      /**
       * A transfer moved fewer shares than entered: the source account held
       * `quantity` fewer at that date. Only what existed moved; the form is a
       * draft until the transfer or the missing history is fixed.
       */
      kind: 'transfer-shortfall';
      instrument: string;
      isin?: string;
      fromAccount: string;
      toAccount: string;
      quantity: number;
      before: Date;
    }
  | {
      /**
       * A transfer row is ignored: both accounts must be set and differ, and
       * the quantity must be positive.
       */
      kind: 'transfer-invalid';
      instrument: string;
      date: Date;
    };

/** A transfer asked for more shares than its source account held. */
interface TransferShortfall {
  action: EnrichedCorporateAction;
  missing: number;
}

type TimelineEvent =
  | { kind: 'trade'; datetime: Date; trade: EnrichedTrade }
  | { kind: 'action'; datetime: Date; action: EnrichedCorporateAction }
  | {
      kind: 'carry-in';
      datetime: Date;
      key: string;
      quantity: number;
      costPerSharePln: number;
      costMissing: boolean;
      rateUnavailable: boolean;
      /** See `FifoLot.protectedUntil`. */
      protectedUntil?: number;
    };

/** Tie-break order on equal datetime: action, then carry-in, then trade. */
const KIND_ORDER: Record<TimelineEvent['kind'], number> = {
  'action': 0,
  'carry-in': 1,
  'trade': 2,
};

function lotKey(args: {
  account?: string;
  isin?: string;
  symbol: string;
  lotId?: string;
}): string {
  return queueKey(args.account ?? '', instrumentBase(args), args.lotId);
}

/** Warning payload field; omitted for sessions without accounts. */
function accountField(account: string | undefined): { account?: string } {
  return account ? { account } : {};
}

type IsinMapFor = (account: string) => Map<string, string>;

function isInPeriod(args: { datetime: Date; taxPeriod: TaxPeriod }): boolean {
  return isInTaxPeriod({ date: args.datetime, taxPeriod: args.taxPeriod });
}

function getOrCreateLots(
  lotQueues: Map<string, FifoLot[]>,
  key: string,
): FifoLot[] {
  let lots = lotQueues.get(key);
  if (!lots) {
    lots = [];
    lotQueues.set(key, lots);
  }
  return lots;
}

/** FIFO-based capital gains calculator (one queue per account). */
export function calculateCapitalGains(
  args: CalculateCapitalGainsArgs,
): TradeResult[] {
  const { corporateActions } = args;

  // Names an instrument goes by across brokers (symbol <-> ISIN), over all
  // accounts: used to place unstamped rows and to find transfer donors.
  const globalIsin = buildSymbolIsinMap({
    trades: args.trades,
    corporateActions,
  });
  for (const pos of args.carryInPositions) {
    const symbol = pos.symbol.toUpperCase();
    if (pos.isin && !globalIsin.has(symbol)) globalIsin.set(symbol, pos.isin);
  }

  // Components built once: the join decisions and the dry runs must agree on
  // which rows belong together.
  const componentOf = createComponents({
    trades: args.trades,
    carryInPositions: args.carryInPositions,
    corporateActions,
    symbolToIsin: globalIsin,
  });
  const assignArgs = {
    trades: args.trades,
    corporateActions,
    carryInPositions: args.carryInPositions,
    symbolToIsin: globalIsin,
    componentOf,
  };
  // Unstamped rows first stand apart; they join an account only if that
  // resolves a shortfall seen in this dry run.
  let assigned = assignAccounts(assignArgs);
  if (assigned.unstamped.size > 0) {
    const apart = assigned;
    // Rows bucketed by component once, so each dry run sees only its own.
    interface Bucket {
      trades: EnrichedTrade[];
      carryInPositions: EnrichedCarryInPosition[];
      corporateActions: EnrichedCorporateAction[];
    }
    const buckets = new Map<string, Bucket>();
    const bucketOf = (row: { isin?: string; symbol: string }): Bucket => {
      const id = componentOf(row);
      let bucket = buckets.get(id);
      if (!bucket) {
        bucket = { trades: [], carryInPositions: [], corporateActions: [] };
        buckets.set(id, bucket);
      }
      return bucket;
    };
    for (const t of apart.trades) bucketOf(t).trades.push(t);
    for (const c of apart.carryInPositions) {
      bucketOf(c).carryInPositions.push(c);
    }
    for (const a of corporateActions) bucketOf(a).corporateActions.push(a);

    const apartStats = new Map<string, ComponentStats>();
    const dry = (
      anchor: string,
      joins: ReadonlyMap<string, string>,
    ): ComponentStats => {
      const component = apart.unstamped.get(anchor)?.component ?? anchor;
      if (joins.size === 0) {
        const known = apartStats.get(component);
        if (known) return known;
      }
      const bucket = buckets.get(component);
      if (!bucket) {
        throw new Error(
          `Dry run of component '${component}' (${anchor}) found no rows`,
        );
      }
      const remap = <
        R extends { account?: string; isin?: string; symbol: string },
      >(
        row: R,
      ): R => {
        const account =
          row.account === UNASSIGNED_ACCOUNT
            ? joins.get(instrumentGroup(row, globalIsin))
            : undefined;
        return account ? { ...row, account } : row;
      };
      const trades = bucket.trades.map(remap);
      const carryInPositions = bucket.carryInPositions.map(remap);
      const stats = componentStats(
        runPass({
          ...args,
          onWarning: undefined,
          corporateActions: bucket.corporateActions,
          assigned: {
            trades,
            carryInPositions,
            accounts: [
              ...new Set([
                ...trades.map((t) => t.account ?? ''),
                ...carryInPositions.map((c) => c.account ?? ''),
                ...transferAccounts(bucket.corporateActions),
              ]),
            ].toSorted(),
          },
        }),
      );
      if (joins.size === 0) apartStats.set(component, stats);
      return stats;
    };
    assigned = assignAccounts({
      ...assignArgs,
      decisions: decideJoins(apart.unstamped, dry),
    });
  }
  for (const warning of assigned.warnings) args.onWarning?.(warning);

  for (const action of args.corporateActions) {
    if (action.type === 'transfer' && !isTransfer(action)) {
      args.onWarning?.({
        kind: 'transfer-invalid',
        instrument: action.symbol,
        date: action.datetime,
      });
    }
  }
  const pass = runPass({ ...args, assigned, onWarning: args.onWarning });
  for (const { action, missing } of pass.transferShortfalls) {
    args.onWarning?.({
      kind: 'transfer-shortfall',
      instrument: action.symbol,
      isin: action.isin,
      fromAccount: action.fromAccount ?? '',
      toAccount: action.toAccount ?? '',
      quantity: missing,
      before: action.datetime,
    });
  }
  const warnings = shortfallWarnings({
    requests: pass.shortfalls,
    accounts: assigned.accounts,
    symbolToIsin: globalIsin,
    holdingsAtTimes: (times) =>
      simulateHoldings(
        pass.timeline,
        Infinity,
        pass.isinMapFor,
        assigned.accounts,
        times,
      ).snapshots,
  });
  for (const warning of warnings) args.onWarning?.(warning);

  // A suggested transfer means the donor's own FIFO is unreliable too: the
  // shares may have left its oldest lots, so its later sells are drafts.
  for (const warning of warnings) {
    if (warning.kind !== 'transfer-suggested') continue;
    const names = instrumentNames(
      { symbol: warning.instrument, isin: warning.isin },
      globalIsin,
    );
    for (const [result, trade] of pass.sellOrigins) {
      if (
        trade.account === warning.fromAccount &&
        trade.datetime >= warning.before &&
        [...instrumentNames(trade, globalIsin)].some((name) => names.has(name))
      ) {
        result.costBasisMissing = true;
      }
    }
  }

  return pass.results;
}

/** Shortfall and in-period sells of a dry run (one component). */
function componentStats(pass: ReturnType<typeof runPass>): ComponentStats {
  const shortfallByAccount = new Map<string, number>();
  let shortfall = 0;
  for (const { trade, missing } of pass.shortfalls) {
    shortfall += missing;
    const account = trade.account ?? '';
    shortfallByAccount.set(
      account,
      (shortfallByAccount.get(account) ?? 0) + missing,
    );
  }
  // A transfer the source cannot cover is a shortfall of the source account.
  for (const { action, missing } of pass.transferShortfalls) {
    shortfall += missing;
    const account = action.fromAccount ?? '';
    shortfallByAccount.set(
      account,
      (shortfallByAccount.get(account) ?? 0) + missing,
    );
  }
  const signature = pass.results
    .filter((r) => r.type === 'sell')
    .map(
      (r) =>
        `${r.symbol}|${String(r.datetime.getTime())}|${String(r.quantity)}|${r.costPln.toFixed(6)}|${String(r.costBasisMissing ?? false)}`,
    )
    .toSorted()
    .join(';');
  return { shortfall, shortfallByAccount, signature };
}

function runPass(
  args: CalculateCapitalGainsArgs & {
    assigned: Pick<
      ReturnType<typeof assignAccounts>,
      'trades' | 'carryInPositions' | 'accounts'
    >;
  },
): {
  results: TradeResult[];
  shortfalls: ShortfallRequest[];
  transferShortfalls: TransferShortfall[];
  timeline: TimelineEvent[];
  isinMapFor: IsinMapFor;
  sellOrigins: Map<TradeResult, EnrichedTrade>;
} {
  const { corporateActions, taxPeriod } = args;
  const { trades, carryInPositions, accounts } = args.assigned;
  const symbolCountryMap = args.symbolCountryMap ?? new Map<string, string>();
  const lotQueues = new Map<string, FifoLot[]>();
  const results: TradeResult[] = [];
  const sellOrigins = new Map<TradeResult, EnrichedTrade>();

  // Build unified timeline (carry-ins are added below, after reconciliation)
  const timeline: TimelineEvent[] = [
    ...trades.map((trade): TimelineEvent => ({
      kind: 'trade',
      datetime: trade.datetime,
      trade,
    })),
    ...corporateActions.map((action): TimelineEvent => ({
      kind: 'action',
      datetime: action.datetime,
      action,
    })),
  ];
  timeline.sort(compareEvents);

  // Symbol -> ISIN per account: a manual carry-in without an ISIN must not
  // join another account's ISIN queue.
  const isinMaps = new Map<string, Map<string, string>>();
  for (const account of accounts) {
    isinMaps.set(
      account,
      buildSymbolIsinMap({
        trades: trades.filter((t) => t.account === account),
        corporateActions: corporateActions.filter(
          (a) => !a.account || a.account === account,
        ),
      }),
    );
  }
  const isinMapFor: IsinMapFor = (account) =>
    isinMaps.get(account) ?? new Map<string, string>();

  // Carry-ins are lots like any other buy: seeded at their real acquisition
  // date so FIFO (art. 24 ust. 10 updof) orders them against imported buys.
  timeline.push(
    ...buildCarryInEvents({
      carryInPositions,
      isinMapFor,
      accounts,
      events: [...timeline],
      taxPeriod,
      onWarning: args.onWarning,
    }),
  );
  timeline.sort(compareEvents);

  const isNewSplit = createSplitDeduper();
  const taintedQueues = new Set<string>();
  // Queues a transfer left short: their sells are already explained.
  const transferShort = new Set<string>();
  const shortfalls: ShortfallRequest[] = [];
  const transferShortfalls: TransferShortfall[] = [];

  for (const event of timeline) {
    if (event.kind === 'carry-in') {
      getOrCreateLots(lotQueues, event.key).push({
        quantity: event.quantity,
        costPerSharePln: event.costPerSharePln,
        commissionPerSharePln: 0,
        rateUnavailable: event.rateUnavailable,
        ...(event.costMissing ? { costMissing: true } : {}),
        acquiredAt: event.datetime,
        ...(event.protectedUntil === undefined
          ? {}
          : { protectedUntil: event.protectedUntil }),
      });
    } else if (event.kind === 'action' && event.action.type === 'transfer') {
      processTransfer({
        action: event.action,
        at: event.datetime.getTime(),
        isinMapFor,
        taintedQueues,
        transferShort,
        lotQueues,
        transferShortfalls,
      });
    } else if (event.kind === 'action') {
      processAction({
        action: event.action,
        isinMapFor,
        accounts,
        isNewSplit,
        taintedQueues,
        lotQueues,
        results,
        taxPeriod,
        symbolCountryMap,
      });
    } else {
      const before = results.length;
      processTrade({
        trade: event.trade,
        lotQueues,
        results,
        taxPeriod,
        symbolCountryMap,
        taintedQueues,
        transferShort,
        shortfalls,
      });
      if (results.length > before && event.trade.type === 'sell') {
        sellOrigins.set(results[results.length - 1], event.trade);
      }
    }
  }

  return {
    results,
    shortfalls,
    transferShortfalls,
    timeline,
    isinMapFor,
    sellOrigins,
  };
}

/**
 * Sort by datetime; corporate actions, then carry-ins, then trades on the same
 * datetime. When two trades share a datetime, break ties by `lotId` so per-lot
 * output order is stable regardless of DB insertion / array order — the data
 * table is a stable sort by datetime, so this order flows through to display.
 */
function compareEvents(a: TimelineEvent, b: TimelineEvent): number {
  const timeDiff = a.datetime.getTime() - b.datetime.getTime();
  if (timeDiff !== 0) return timeDiff;
  if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  // A transfer moves lots after the splits and mergers of the same moment.
  if (a.kind === 'action' && b.kind === 'action') {
    const aMoves = a.action.type === 'transfer';
    if (aMoves !== (b.action.type === 'transfer')) return aMoves ? 1 : -1;
  }
  if (a.kind === 'trade' && b.kind === 'trade') {
    const aLot = a.trade.lotId ?? '';
    const bLot = b.trade.lotId ?? '';
    if (aLot !== bLot) return aLot < bLot ? -1 : 1;
  }
  return 0;
}

function endOfYear(year: number): Date {
  return new Date(year, 11, 31, 23, 59, 59);
}

/**
 * FIFO key of a merger's target in `account`. Without a target ISIN the target
 * symbol is resolved through the account's symbol → ISIN map, so the new lots
 * land under the same key as the target's trades.
 */
function mergerTargetKey(
  action: EnrichedCorporateAction,
  account: string,
  symbolToIsin: Map<string, string>,
): string | undefined {
  if (action.targetIsin)
    return queueKey(account, action.targetIsin.toUpperCase());
  if (!action.targetSymbol) return undefined;
  const symbol = action.targetSymbol.toUpperCase();
  return queueKey(account, (symbolToIsin.get(symbol) ?? symbol).toUpperCase());
}

interface Shortfall {
  /** Datetime of the first sell that drives the key below zero. */
  datetime: Date;
  /** Shares missing right after that sell. */
  quantity: number;
}

/**
 * Replay `events` (sorted) up to and including `until`: trades, splits, mergers
 * and already-seeded carry-ins. Returns the holdings per lot key and, per key,
 * the first sell that would drive it below zero (imported sells of shares the
 * imported history does not explain).
 */
function simulateHoldings(
  events: TimelineEvent[],
  until: number,
  isinMapFor: IsinMapFor,
  accounts: readonly string[],
  /** Times (ms, ascending) at which to copy the holdings into `snapshots`. */
  checkpoints: readonly number[] = [],
): {
  holdings: Map<string, number>;
  shortfalls: Map<string, Shortfall>;
  snapshots: Map<number, Map<string, number>>;
} {
  const net = new Map<string, number>();
  const shortfalls = new Map<string, Shortfall>();
  const snapshots = new Map<number, Map<string, number>>();
  const isNewSplit = createSplitDeduper();
  // Carry-in shares that transfers up to `until` cannot draw from.
  const shielded = new Map<string, { quantity: number; until: number }[]>();
  const shieldedAt = (key: string, time: number) =>
    (shielded.get(key) ?? []).reduce(
      (sum, s) => (s.until >= time ? sum + s.quantity : sum),
      0,
    );
  let next = 0;
  const snapshotBefore = (time: number) => {
    while (next < checkpoints.length && checkpoints[next] < time) {
      snapshots.set(checkpoints[next], new Map(net));
      next++;
    }
  };
  for (const event of events) {
    snapshotBefore(event.datetime.getTime());
    if (event.datetime.getTime() > until) break;
    if (event.kind === 'carry-in') {
      net.set(event.key, (net.get(event.key) ?? 0) + event.quantity);
      if (event.protectedUntil !== undefined) {
        const list = shielded.get(event.key) ?? [];
        list.push({ quantity: event.quantity, until: event.protectedUntil });
        shielded.set(event.key, list);
      }
    } else if (event.kind === 'trade') {
      const key = lotKey(event.trade);
      const sign = event.trade.type === 'buy' ? 1 : -1;
      // FIFO: sells reach the (oldest) shielded carry-in shares first.
      let sold = event.trade.type === 'sell' ? event.trade.quantity : 0;
      for (const s of shielded.get(key) ?? []) {
        const used = Math.min(s.quantity, sold);
        s.quantity -= used;
        sold -= used;
      }
      const qty = (net.get(key) ?? 0) + sign * event.trade.quantity;
      net.set(key, qty);
      if (qty < -1e-9 && !shortfalls.has(key)) {
        shortfalls.set(key, { datetime: event.datetime, quantity: -qty });
      }
    } else if (isTransfer(event.action)) {
      const { action } = event;
      const sources = transferSourceKeys({
        keys: net.keys(),
        action,
        symbolToIsin: isinMapFor(action.fromAccount ?? ''),
      });
      let remaining = action.quantity ?? 0;
      const time = event.datetime.getTime();
      for (const key of sources) {
        const held = (net.get(key) ?? 0) - shieldedAt(key, time);
        if (held <= 0 || remaining <= 0) continue;
        const used = Math.min(held, remaining);
        net.set(key, (net.get(key) ?? 0) - used);
        remaining -= used;
      }
      const moved = (action.quantity ?? 0) - remaining;
      if (moved > 0) {
        const destKey = transferDestKey({
          action,
          symbolToIsin: isinMapFor(action.toAccount ?? ''),
        });
        net.set(destKey, (net.get(destKey) ?? 0) + moved);
      }
    } else if (event.action.type === 'transfer') {
      continue;
    } else {
      const { action } = event;
      for (const { account, key } of actionTargets(action, accounts)) {
        const qty = net.get(key);
        if (qty === undefined) continue;
        if (action.type === 'stock-split') {
          if (action.denominator !== 0 && isNewSplit(key, action)) {
            net.set(key, (qty * action.numerator) / action.denominator);
            for (const s of shielded.get(key) ?? []) {
              s.quantity = (s.quantity * action.numerator) / action.denominator;
            }
          }
        } else {
          net.delete(key);
          shielded.delete(key);
          const targetKey = mergerTargetKey(
            action,
            account,
            isinMapFor(account),
          );
          const ratio = action.conversionRatio ?? 0;
          if (targetKey && ratio > 0) {
            net.set(targetKey, (net.get(targetKey) ?? 0) + qty * ratio);
          }
        }
      }
    }
  }
  snapshotBefore(Number.POSITIVE_INFINITY);
  return { holdings: net, shortfalls, snapshots };
}

/**
 * Symbol → ISIN map from trades and corporate actions (source and target
 * sides), used to key carry-ins that arrive without an ISIN and to resolve
 * merger targets. A corporate action's ISIN is not used for a symbol that also
 * has trades without an ISIN: those trades are keyed by symbol, and keying the
 * carry-in by ISIN would split the instrument across two FIFO queues.
 */
export function buildSymbolIsinMap(args: {
  trades: EnrichedTrade[];
  corporateActions: EnrichedCorporateAction[];
}): Map<string, string> {
  const map = new Map<string, string>();
  const symbolKeyedTrades = new Set<string>();
  for (const trade of args.trades) {
    const symbol = trade.symbol.toUpperCase();
    if (!trade.isin) symbolKeyedTrades.add(symbol);
    else if (!map.has(symbol)) map.set(symbol, trade.isin);
  }
  const add = (symbol: string | undefined, isin: string | undefined) => {
    if (!symbol || !isin) return;
    const key = symbol.toUpperCase();
    if (!map.has(key) && !symbolKeyedTrades.has(key)) map.set(key, isin);
  };
  for (const action of args.corporateActions) {
    add(action.symbol, action.isin);
    add(action.targetSymbol, action.targetIsin);
  }
  return map;
}

interface SnapshotRow {
  pos: EnrichedCarryInPosition;
  /** Placement on the timeline (acquisition date or derived). */
  datetime: Date;
  /** Quantity to seed, in end-of-`year` units. */
  seedQty: number;
}

/** Product of `key`'s split ratios effective in (`from`, `to`], each split once. */
function splitFactor(
  events: TimelineEvent[],
  key: string,
  from: number,
  to: number,
  accounts: readonly string[],
): number {
  let factor = 1;
  const isNewSplit = createSplitDeduper();
  for (const event of events) {
    const t = event.datetime.getTime();
    if (
      event.kind === 'action' &&
      event.action.type === 'stock-split' &&
      event.action.denominator !== 0 &&
      t > from &&
      t <= to &&
      actionTargets(event.action, accounts).some((target) => target.key === key)
    ) {
      if (!isNewSplit(key, event.action)) continue;
      factor *= event.action.numerator / event.action.denominator;
    }
  }
  return factor;
}

/**
 * Turn carry-in positions into timeline events.
 *
 * A carry-in is a **snapshot**: the quantity of one instrument held at the end
 * of `year`. Multi-year imports bring one snapshot per year, and imported
 * trades may already explain part of it. Per lot key, snapshots are processed
 * from the earliest year:
 *
 * - The holding implied at the end of `year` by imported trades and previously
 *   seeded carry-ins is compared with the snapshot. The difference was held
 *   before every imported trade since the previous snapshot: it is modelled as
 *   one lot at the earliest row placement, priced like the oldest row. A
 *   snapshot below the implied holding, or one that still leaves an imported
 *   sell uncovered, is reported as inconsistent and seeds nothing.
 * - FIFO sells that lot before any later imported buy. The part imported sells
 *   consume is seeded at that placement; the part that survives to the end of
 *   `year` is the unexplained share of the snapshot. The rest of the snapshot
 *   is explained by imported buys (overlap warning): the latest-acquired rows
 *   are dropped first and the remaining rows are seeded at their placement.
 * - Key: falls back to the ISIN of a trade / corporate action with the same
 *   symbol (IBKR MTM rows, old DB rows and cross-file imports lack an ISIN).
 * - Date: `acquisitionDate`; otherwise just before the earliest imported trade
 *   after the previous snapshot (so FIFO consumes these older shares first),
 *   capped at the end of `year` and before the tax period.
 * - Units: `quantity` is as of the end of `year`, so splits between the placement
 *   date and the end of `year` are already reflected and the seeded quantity is
 *   pre-divided by them; later splits are applied by the timeline.
 */
function buildCarryInEvents(args: {
  carryInPositions: EnrichedCarryInPosition[];
  isinMapFor: IsinMapFor;
  accounts: readonly string[];
  /** Sorted trades and corporate actions. */
  events: TimelineEvent[];
  taxPeriod: TaxPeriod;
  onWarning?: (warning: CarryInWarning) => void;
}): TimelineEvent[] {
  const { carryInPositions, events, taxPeriod, isinMapFor, accounts } = args;
  if (carryInPositions.length === 0) return [];

  const periodStart = taxPeriod.from.getTime();

  // key -> year -> rows
  const snapshots = new Map<string, Map<number, EnrichedCarryInPosition[]>>();
  for (const pos of carryInPositions) {
    if (!(pos.quantity > 0)) continue;
    const key = lotKey({
      account: pos.account,
      isin:
        pos.isin ?? isinMapFor(pos.account ?? '').get(pos.symbol.toUpperCase()),
      symbol: pos.symbol,
    });
    let byYear = snapshots.get(key);
    if (!byYear) {
      byYear = new Map();
      snapshots.set(key, byYear);
    }
    const rows = byYear.get(pos.year) ?? [];
    rows.push(pos);
    byYear.set(pos.year, rows);
  }

  const tradeTimesByKey = new Map<string, number[]>();
  for (const event of events) {
    if (event.kind !== 'trade') continue;
    const key = lotKey(event.trade);
    const times = tradeTimesByKey.get(key) ?? [];
    times.push(event.datetime.getTime());
    tradeTimesByKey.set(key, times);
  }

  const years = [
    ...new Set([...snapshots.values()].flatMap((m) => [...m.keys()])),
  ].toSorted((a, b) => a - b);
  const previousYear = new Map<string, number>();
  const seeded: TimelineEvent[] = [];
  const simulate = (until: number) =>
    simulateHoldings(
      [...events, ...seeded].toSorted(compareEvents),
      until,
      isinMapFor,
      accounts,
    );

  for (const year of years) {
    const yearEnd = endOfYear(year).getTime();

    // Place every snapshot row of this year.
    const placedByKey = new Map<string, SnapshotRow[]>();
    const historyStart = new Map<string, number>();
    // Keys a transfer leaves between their previous snapshot and this one:
    // the snapshot is the holding after it, so it keeps its shares.
    const transferredOut = new Map<string, number>();
    for (const [key, byYear] of snapshots) {
      const rows = byYear.get(year);
      if (!rows) continue;
      // Undated rows go just before the earliest imported trade after the
      // previous snapshot (oldest shares first), never past the snapshot or
      // into the tax period.
      const prevEnd = previousYear.has(key)
        ? endOfYear(previousYear.get(key) ?? year).getTime()
        : Number.NEGATIVE_INFINITY;
      previousYear.set(key, year);
      if (
        events.some((e) =>
          isTransferOutOf(e, key, prevEnd, yearEnd, isinMapFor),
        )
      ) {
        transferredOut.set(key, prevEnd);
      }
      const nextTrade = (tradeTimesByKey.get(key) ?? []).find(
        (t) => t > prevEnd,
      );
      const undatedTime = Math.min(
        nextTrade === undefined ? yearEnd : nextTrade - 1000,
        yearEnd,
        periodStart - 1000,
      );
      const placed = rows
        .map((pos) => ({
          pos,
          datetime: pos.acquisitionDate ?? new Date(undatedTime),
          seedQty: pos.quantity,
        }))
        .toSorted((a, b) => a.datetime.getTime() - b.datetime.getTime());
      placedByKey.set(key, placed);
      historyStart.set(
        key,
        Math.min(undatedTime, placed[0].datetime.getTime()),
      );
    }

    const { holdings } = simulate(yearEnd);
    for (const [key, placed] of placedByKey) {
      const spanStart = transferredOut.get(key);
      const shielded = spanStart !== undefined;
      // The transfers out of the span are not part of the history that
      // explains the snapshot.
      const keyEvents = shielded
        ? events.filter(
            (e) => !isTransferOutOf(e, key, spanStart, yearEnd, isinMapFor),
          )
        : events;
      const protectedUntil = shielded ? { protectedUntil: yearEnd } : {};
      const first = placed[0].pos;
      const snapshotQty = placed.reduce((sum, row) => sum + row.seedQty, 0);
      const implied = shielded
        ? (simulateHoldings(
            [...keyEvents, ...seeded].toSorted(compareEvents),
            yearEnd,
            isinMapFor,
            accounts,
          ).holdings.get(key) ?? 0)
        : (holdings.get(key) ?? 0);
      const eps = Math.max(snapshotQty, 1) * 1e-9;
      const start = historyStart.get(key) ?? yearEnd;
      const startFactor = splitFactor(events, key, start, yearEnd, accounts);
      // Shares the imported history does not explain (end-of-`year` units),
      // provisionally one lot older than every imported trade since the
      // previous snapshot, priced like the oldest row.
      const unexplained = snapshotQty - implied;
      const historyLot = (quantity: number): TimelineEvent => ({
        kind: 'carry-in',
        datetime: new Date(start),
        key,
        quantity: quantity / startFactor,
        costPerSharePln: (first.costPln / first.quantity) * startFactor,
        costMissing: first.costMissing,
        rateUnavailable: first.rateUnavailable,
        ...protectedUntil,
      });

      const inconsistent =
        unexplained < -eps ||
        simulateHoldings(
          [
            ...keyEvents,
            ...seeded,
            historyLot(Math.max(unexplained, 0)),
          ].toSorted(compareEvents),
          yearEnd,
          isinMapFor,
          accounts,
        ).shortfalls.has(key);
      if (inconsistent) {
        args.onWarning?.({
          kind: 'carry-in-inconsistent',
          symbol: first.symbol,
          isin: first.isin,
          year,
          carryInQuantity: snapshotQty,
          impliedQuantity: implied,
          ...accountField(first.account),
        });
        continue;
      }

      // FIFO: later sells consume that oldest lot before any imported buy, so
      // what survives of it at the end of `year` is the part of the snapshot
      // the imported buys do not explain. The rest of it was sold by imported
      // sells and is seeded at `start`.
      const withoutLaterBuys = [...keyEvents, ...seeded].filter(
        (e) =>
          !(
            e.kind === 'trade' &&
            e.trade.type === 'buy' &&
            lotKey(e.trade) === key &&
            e.datetime.getTime() > start
          ),
      );
      const left =
        simulateHoldings(
          [...withoutLaterBuys, historyLot(unexplained)].toSorted(
            compareEvents,
          ),
          yearEnd,
          isinMapFor,
          accounts,
        ).holdings.get(key) ?? 0;
      const survives = Math.min(Math.max(left, 0), unexplained);
      if (unexplained - survives > eps) {
        seeded.push(historyLot(unexplained - survives));
      }

      // Imported buys explain the rest of the snapshot: drop the
      // latest-acquired shares first.
      const covered = snapshotQty - survives;
      if (covered > eps) {
        let remaining = covered;
        for (const row of placed.toReversed()) {
          if (remaining <= eps) break;
          const used = Math.min(remaining, row.seedQty);
          row.seedQty -= used;
          remaining -= used;
          if (
            row.seedQty > eps &&
            !row.pos.costMissing &&
            row.pos.costPln > 0
          ) {
            args.onWarning?.({
              kind: 'carry-in-cost-prorated',
              symbol: row.pos.symbol,
              isin: row.pos.isin,
              year,
              carryInQuantity: row.pos.quantity,
              seededQuantity: row.seedQty,
              ...accountField(row.pos.account),
            });
          }
        }
        args.onWarning?.({
          kind: 'carry-in-overlap',
          symbol: first.symbol,
          isin: first.isin,
          year,
          carryInQuantity: snapshotQty,
          coveredQuantity: covered,
          ...accountField(first.account),
        });
      }

      for (const row of placed) {
        if (row.seedQty <= eps) continue;
        const factor = splitFactor(
          events,
          key,
          row.datetime.getTime(),
          yearEnd,
          accounts,
        );
        const quantity = row.seedQty / factor;
        const costPln = (row.pos.costPln * row.seedQty) / row.pos.quantity;
        seeded.push({
          kind: 'carry-in',
          datetime: row.datetime,
          key,
          quantity,
          costPerSharePln: costPln / quantity,
          costMissing: row.pos.costMissing,
          rateUnavailable: row.pos.rateUnavailable,
          ...protectedUntil,
        });
      }
    }
  }
  return seeded;
}

/** A transfer dated in (`after`, `until`] that draws from the queue `key`. */
function isTransferOutOf(
  event: TimelineEvent,
  key: string,
  after: number,
  until: number,
  isinMapFor: IsinMapFor,
): boolean {
  if (event.kind !== 'action' || !isTransfer(event.action)) return false;
  const time = event.datetime.getTime();
  if (time <= after || time > until) return false;
  return (
    transferSourceKeys({
      keys: [key],
      action: event.action,
      symbolToIsin: isinMapFor(event.action.fromAccount ?? ''),
    }).length > 0
  );
}

/**
 * Move shares between accounts (not a disposal: no proceeds, no income). Only
 * what the source holds moves; the rest is a shortfall and drafts the
 * destination's later sells, because their FIFO order is then unknown.
 */
function processTransfer(args: {
  action: EnrichedCorporateAction;
  at: number;
  isinMapFor: IsinMapFor;
  taintedQueues: Set<string>;
  transferShort: Set<string>;
  lotQueues: Map<string, FifoLot[]>;
  transferShortfalls: TransferShortfall[];
}): void {
  const { action, lotQueues, taintedQueues } = args;
  if (!isTransfer(action)) return;
  const quantity = action.quantity ?? 0;
  const sourceKeys = transferSourceKeys({
    keys: lotQueues.keys(),
    action,
    symbolToIsin: args.isinMapFor(action.fromAccount ?? ''),
  });
  const destKey = transferDestKey({
    action,
    symbolToIsin: args.isinMapFor(action.toAccount ?? ''),
  });
  const { missing } = moveLots({
    lotQueues,
    sourceKeys,
    destKey,
    quantity,
    at: args.at,
    epsilon: Math.min(Math.max(quantity, 1) * 1e-9, 1e-8),
  });
  if (missing > 0) {
    args.transferShortfalls.push({ action, missing });
    args.transferShort.add(destKey);
  }
  if (missing > 0 || sourceKeys.some((key) => taintedQueues.has(key))) {
    taintedQueues.add(destKey);
  }
}

function processAction(args: {
  action: EnrichedCorporateAction;
  isinMapFor: IsinMapFor;
  accounts: readonly string[];
  isNewSplit: (key: string, action: EnrichedCorporateAction) => boolean;
  taintedQueues: Set<string>;
  lotQueues: Map<string, FifoLot[]>;
  results: TradeResult[];
  taxPeriod: TaxPeriod;
  symbolCountryMap: Map<string, string>;
}): void {
  for (const target of actionTargets(args.action, args.accounts)) {
    applyActionToQueue({ ...args, ...target });
  }
}

function applyActionToQueue(args: {
  action: EnrichedCorporateAction;
  account: string;
  key: string;
  isinMapFor: IsinMapFor;
  isNewSplit: (key: string, action: EnrichedCorporateAction) => boolean;
  taintedQueues: Set<string>;
  lotQueues: Map<string, FifoLot[]>;
  results: TradeResult[];
  taxPeriod: TaxPeriod;
  symbolCountryMap: Map<string, string>;
}): void {
  const { action, lotQueues, key } = args;
  const lots = lotQueues.get(key);

  if (!lots || lots.length === 0) return;

  if (action.type === 'stock-split') {
    // The same split reported by two sources applies once per queue.
    if (!args.isNewSplit(key, action)) return;
    const newLots = applyStockSplit({
      lots,
      numerator: action.numerator,
      denominator: action.denominator,
    });
    lotQueues.set(key, newLots);
  } else {
    // action.type === 'merger'
    const mergerResult = applyMerger({
      lots,
      conversionRatio: action.conversionRatio ?? 0,
      cashPerShare: action.cashPerShare ?? 0,
      cashCurrency: action.cashCurrency ?? '',
      cashExchangeRate: action.cashExchangeRate,
      newSharesValue: action.newSharesValue,
    });

    // Remove old symbol lots
    lotQueues.delete(key);

    // Move new lots to target symbol
    const targetKey = mergerTargetKey(
      action,
      args.account,
      args.isinMapFor(args.account),
    );
    if (targetKey && args.taintedQueues.has(key)) {
      args.taintedQueues.add(targetKey);
    }
    if (mergerResult.newLots.length > 0 && targetKey) {
      const targetLots = getOrCreateLots(lotQueues, targetKey);
      targetLots.push(...mergerResult.newLots);
    }

    // Record cash proceeds as synthetic sell (if in tax period)
    if (
      mergerResult.cashProceeds > 0 &&
      isInPeriod({ datetime: action.datetime, taxPeriod: args.taxPeriod })
    ) {
      const cashExRate = action.cashExchangeRate;
      const proceedsPln = mergerResult.cashProceeds * cashExRate;
      const costPln = mergerResult.cashCostPln;
      args.results.push({
        symbol: action.symbol,
        datetime: action.datetime,
        type: 'sell',
        source: 'corporate-action',
        quantity: 0,
        price: 0,
        proceeds: mergerResult.cashProceeds,
        commission: 0,
        currency: mergerResult.cashCurrency,
        exchangeRate: cashExRate,
        proceedsPln,
        costPln,
        gainLossPln: proceedsPln - costPln,
        taxPln: Math.max(proceedsPln - costPln, 0) * TAX_RATE,
        rateUnavailable:
          action.cashRateUnavailable || mergerResult.costRateUnavailable,
        costRateUnavailable: mergerResult.costRateUnavailable,
        country: args.symbolCountryMap.get(action.symbol) ?? 'XX',
        foreignTaxPln: 0,
        foreignTaxOriginal: 0,
        ...(mergerResult.costMissing || args.taintedQueues.has(key)
          ? { costBasisMissing: true }
          : {}),
      });
    }
  }
}

function processTrade(args: {
  trade: EnrichedTrade;
  lotQueues: Map<string, FifoLot[]>;
  results: TradeResult[];
  taxPeriod: TaxPeriod;
  symbolCountryMap: Map<string, string>;
  /** Queues that sold shares they did not hold: every later sell is a draft. */
  taintedQueues: Set<string>;
  transferShort: Set<string>;
  shortfalls: ShortfallRequest[];
}): void {
  const { trade, lotQueues, results, taxPeriod } = args;
  const key = lotKey(trade);
  const lots = getOrCreateLots(lotQueues, key);

  if (trade.type === 'buy') {
    // Incentive shares: income taxed at acquisition is part of the cost.
    const incentive = isIncentiveBuy(trade)
      ? incentiveExtraCost(trade)
      : undefined;
    const costPerSharePln =
      trade.price * trade.exchangeRate +
      (trade.quantity > 0 && incentive
        ? incentive.extraCostPln / trade.quantity
        : 0);
    const commissionPln = trade.commission * trade.commissionExchangeRate;
    const commissionPerSharePln =
      trade.quantity > 0 ? commissionPln / trade.quantity : 0;

    lots.push({
      quantity: trade.quantity,
      costPerSharePln,
      commissionPerSharePln,
      rateUnavailable: trade.rateUnavailable,
      ...(incentive?.costMissing ? { costMissing: true } : {}),
      acquiredAt: trade.datetime,
    });

    if (isInPeriod({ datetime: trade.datetime, taxPeriod })) {
      results.push({
        symbol: trade.symbol,
        datetime: trade.datetime,
        type: 'buy',
        source: trade.source ?? 'trade',
        quantity: trade.quantity,
        price: trade.price,
        proceeds: 0,
        commission: trade.commission,
        currency: trade.currency,
        exchangeRate: trade.exchangeRate,
        proceedsPln: 0,
        costPln: 0,
        gainLossPln: 0,
        taxPln: 0,
        rateUnavailable: trade.rateUnavailable,
        country: args.symbolCountryMap.get(trade.symbol) ?? 'XX',
        foreignTaxPln: 0,
        foreignTaxOriginal: 0,
      });
    }
  } else {
    // Sell — consume lots FIFO
    // Gross proceeds go to PIT-38 poz. 22; the sell commission is a cost
    // (poz. 23) per the MF PIT-38 brochure, so gain/loss is unchanged.
    const proceedsPln = trade.proceeds * trade.exchangeRate;
    const sellCommissionPln = trade.commission * trade.commissionExchangeRate;

    let totalCostPln = 0;
    let remainingQty = trade.quantity;
    let costRateUnavailable = false;
    let costMissing = false;

    // Float subtraction leaves ~1e-15 residue (e.g. 0.1+0.2 != 0.3).
    // Compare against epsilon scaled to trade size, capped so a real
    // fractional shortfall cannot disappear on very large trades.
    const qtyEpsilon = Math.min(
      Math.max(Math.abs(trade.quantity), 1) * 1e-9,
      1e-8,
    );

    while (remainingQty > qtyEpsilon && lots.length > 0) {
      const lot = lots[0];
      const usedQty = Math.min(remainingQty, lot.quantity);
      if (lot.rateUnavailable) costRateUnavailable = true;

      totalCostPln +=
        usedQty * (lot.costPerSharePln + lot.commissionPerSharePln);
      remainingQty -= usedQty;
      if (lot.costMissing) costMissing = true;

      if (lot.quantity - usedQty <= qtyEpsilon) {
        lots.shift();
      } else {
        lot.quantity -= usedQty;
      }
    }

    if (remainingQty > qtyEpsilon) {
      // The account sold shares its history does not explain: they cost 0 and
      // the result is a draft. Nothing is moved between accounts.
      costMissing = true;
      args.taintedQueues.add(key);
      if (!args.transferShort.has(key)) {
        args.shortfalls.push({ trade, missing: remainingQty });
      }
    }
    if (args.taintedQueues.has(key)) costMissing = true;

    totalCostPln += sellCommissionPln;

    if (isInPeriod({ datetime: trade.datetime, taxPeriod })) {
      results.push({
        symbol: trade.symbol,
        datetime: trade.datetime,
        type: 'sell',
        source: trade.source ?? 'trade',
        quantity: trade.quantity,
        price: trade.price,
        proceeds: trade.proceeds,
        commission: trade.commission,
        currency: trade.currency,
        exchangeRate: trade.exchangeRate,
        proceedsPln,
        costPln: totalCostPln,
        sellCommissionPln,
        gainLossPln: proceedsPln - totalCostPln,
        taxPln: Math.max(proceedsPln - totalCostPln, 0) * TAX_RATE,
        rateUnavailable: trade.rateUnavailable || costRateUnavailable,
        costRateUnavailable,
        country: args.symbolCountryMap.get(trade.symbol) ?? 'XX',
        foreignTaxPln: 0,
        foreignTaxOriginal: 0,
        ...(costMissing ? { costBasisMissing: true } : {}),
      });
    }
  }
}
