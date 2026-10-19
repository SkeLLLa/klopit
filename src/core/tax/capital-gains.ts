import {
  TAX_RATE,
  type EnrichedCarryInPosition,
  type EnrichedCorporateAction,
  type EnrichedTrade,
  type TaxPeriod,
  type TradeResult,
} from '../types.js';
import {
  applyMerger,
  applyStockSplit,
  type FifoLot,
} from './corporate-actions.js';
import { isInTaxPeriod } from './period.js';

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
      carryInQuantity: number;
      coveredQuantity: number;
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
    };

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
    };

/** Tie-break order on equal datetime: action, then carry-in, then trade. */
const KIND_ORDER: Record<TimelineEvent['kind'], number> = {
  'action': 0,
  'carry-in': 1,
  'trade': 2,
};

function lotKey(args: {
  isin?: string;
  symbol: string;
  lotId?: string;
}): string {
  const base = (args.isin ?? args.symbol).toUpperCase();
  return args.lotId ? `${base}::${args.lotId}` : base;
}

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

/** FIFO-based capital gains calculator */
export function calculateCapitalGains(
  args: CalculateCapitalGainsArgs,
): TradeResult[] {
  const { trades, corporateActions, carryInPositions, taxPeriod } = args;
  const symbolCountryMap = args.symbolCountryMap ?? new Map<string, string>();
  const lotQueues = new Map<string, FifoLot[]>();
  const results: TradeResult[] = [];

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

  // Carry-ins are lots like any other buy: seeded at their real acquisition
  // date so FIFO (art. 24 ust. 10 updof) orders them against imported buys.
  timeline.push(
    ...buildCarryInEvents({
      carryInPositions,
      trades,
      corporateActions,
      events: [...timeline],
      taxPeriod,
      onWarning: args.onWarning,
    }),
  );
  timeline.sort(compareEvents);

  for (const event of timeline) {
    if (event.kind === 'carry-in') {
      getOrCreateLots(lotQueues, event.key).push({
        quantity: event.quantity,
        costPerSharePln: event.costPerSharePln,
        commissionPerSharePln: 0,
        rateUnavailable: event.rateUnavailable,
        ...(event.costMissing ? { costMissing: true } : {}),
      });
    } else if (event.kind === 'action') {
      processAction({
        action: event.action,
        lotQueues,
        results,
        taxPeriod,
        symbolCountryMap,
      });
    } else {
      processTrade({
        trade: event.trade,
        lotQueues,
        results,
        taxPeriod,
        symbolCountryMap,
      });
    }
  }

  return results;
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
 * Quantity held per lot key after replaying `events` up to and including
 * `until` (trades, splits, mergers and already-seeded carry-ins). Sells may
 * drive a key negative — that is how imported prior sells of carried-in shares
 * show up.
 */
function simulateHoldings(
  events: TimelineEvent[],
  until: number,
): Map<string, number> {
  const net = new Map<string, number>();
  for (const event of events) {
    if (event.datetime.getTime() > until) break;
    if (event.kind === 'carry-in') {
      net.set(event.key, (net.get(event.key) ?? 0) + event.quantity);
    } else if (event.kind === 'trade') {
      const key = lotKey(event.trade);
      const sign = event.trade.type === 'buy' ? 1 : -1;
      net.set(key, (net.get(key) ?? 0) + sign * event.trade.quantity);
    } else {
      const { action } = event;
      const key = lotKey(action);
      const qty = net.get(key);
      if (qty === undefined) continue;
      if (action.type === 'stock-split') {
        if (action.denominator !== 0) {
          net.set(key, (qty * action.numerator) / action.denominator);
        }
      } else {
        net.delete(key);
        const target = action.targetIsin ?? action.targetSymbol;
        const ratio = action.conversionRatio ?? 0;
        if (target && ratio > 0) {
          const targetKey = target.toUpperCase();
          net.set(targetKey, (net.get(targetKey) ?? 0) + qty * ratio);
        }
      }
    }
  }
  return net;
}

/**
 * Symbol → ISIN map from trades and corporate actions (source and target
 * sides), used to key carry-ins that arrive without an ISIN.
 */
function buildSymbolIsinMap(args: {
  trades: EnrichedTrade[];
  corporateActions: EnrichedCorporateAction[];
}): Map<string, string> {
  const map = new Map<string, string>();
  const add = (symbol: string | undefined, isin: string | undefined) => {
    if (!symbol || !isin) return;
    const key = symbol.toUpperCase();
    if (!map.has(key)) map.set(key, isin);
  };
  for (const trade of args.trades) add(trade.symbol, trade.isin);
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

/**
 * Turn carry-in positions into timeline events.
 *
 * A carry-in is a **snapshot**: the quantity of one instrument held at the end
 * of `year`. Multi-year imports bring one snapshot per year, and imported
 * trades may already explain part of it. Per lot key, snapshots are processed
 * from the earliest year:
 *
 * - The holdings implied by imported trades and previously seeded carry-ins at
 *   the end of `year` are compared with the snapshot. Only the unexplained
 *   difference is seeded. A negative difference (the history implies more
 *   shares than the snapshot) is reported and nothing is seeded.
 * - When imported prior sells drove the implied holdings below zero, the
 *   difference exceeds the snapshot — the extra shares are the ones sold, so
 *   the sell finds lots.
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
  trades: EnrichedTrade[];
  corporateActions: EnrichedCorporateAction[];
  /** Sorted trades and corporate actions. */
  events: TimelineEvent[];
  taxPeriod: TaxPeriod;
  onWarning?: (warning: CarryInWarning) => void;
}): TimelineEvent[] {
  const { carryInPositions, events, taxPeriod } = args;
  if (carryInPositions.length === 0) return [];

  const symbolToIsin = buildSymbolIsinMap(args);
  const periodStart = taxPeriod.from.getTime();

  // key -> year -> rows
  const snapshots = new Map<string, Map<number, EnrichedCarryInPosition[]>>();
  for (const pos of carryInPositions) {
    if (!(pos.quantity > 0)) continue;
    const key = lotKey({
      isin: pos.isin ?? symbolToIsin.get(pos.symbol.toUpperCase()),
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

  for (const year of years) {
    const yearEnd = endOfYear(year).getTime();
    const holdings = simulateHoldings(
      [...events, ...seeded].toSorted(compareEvents),
      yearEnd,
    );

    for (const [key, byYear] of snapshots) {
      const rows = byYear.get(year);
      if (!rows) continue;
      const snapshotQty = rows.reduce((sum, p) => sum + p.quantity, 0);
      const implied = holdings.get(key) ?? 0;
      const diff = snapshotQty - implied;
      const eps = Math.max(snapshotQty, 1) * 1e-9;
      const first = rows[0];

      // Undated rows go just before the earliest imported trade after the
      // previous snapshot (oldest shares first), never past the snapshot or
      // into the tax period.
      const prevEnd = previousYear.has(key)
        ? endOfYear(previousYear.get(key) ?? year).getTime()
        : Number.NEGATIVE_INFINITY;
      previousYear.set(key, year);
      const nextTrade = (tradeTimesByKey.get(key) ?? []).find(
        (t) => t > prevEnd,
      );
      const undatedTime = Math.min(
        nextTrade === undefined ? yearEnd : nextTrade - 1000,
        yearEnd,
        periodStart - 1000,
      );

      if (diff < -eps) {
        args.onWarning?.({
          kind: 'carry-in-inconsistent',
          symbol: first.symbol,
          isin: first.isin,
          year,
          carryInQuantity: snapshotQty,
          impliedQuantity: implied,
        });
        continue;
      }
      if (diff <= eps) continue;

      const placed: SnapshotRow[] = rows
        .map((pos) => ({
          pos,
          datetime: pos.acquisitionDate ?? new Date(undatedTime),
          seedQty: pos.quantity,
        }))
        .toSorted((a, b) => a.datetime.getTime() - b.datetime.getTime());

      if (diff >= snapshotQty) {
        // Imported prior sells consumed carried-in shares: the oldest row also
        // supplies the shares that were sold.
        placed[0].seedQty += diff - snapshotQty;
      } else {
        // Imported trades explain part of the snapshot: drop the
        // latest-acquired shares first.
        let covered = snapshotQty - diff;
        for (const row of placed.toReversed()) {
          if (covered <= eps) break;
          const used = Math.min(covered, row.seedQty);
          row.seedQty -= used;
          covered -= used;
          if (!row.pos.costMissing && row.pos.costPln > 0) {
            args.onWarning?.({
              kind: 'carry-in-cost-prorated',
              symbol: row.pos.symbol,
              isin: row.pos.isin,
              year,
              carryInQuantity: row.pos.quantity,
              seededQuantity: row.seedQty,
            });
          }
        }
        args.onWarning?.({
          kind: 'carry-in-overlap',
          symbol: first.symbol,
          isin: first.isin,
          carryInQuantity: snapshotQty,
          coveredQuantity: snapshotQty - diff,
        });
      }

      for (const row of placed) {
        if (row.seedQty <= eps) continue;
        let splitFactor = 1;
        for (const event of events) {
          if (
            event.kind === 'action' &&
            event.action.type === 'stock-split' &&
            event.action.denominator !== 0 &&
            event.datetime.getTime() > row.datetime.getTime() &&
            event.datetime.getTime() <= yearEnd &&
            lotKey(event.action) === key
          ) {
            splitFactor *= event.action.numerator / event.action.denominator;
          }
        }
        const quantity = row.seedQty / splitFactor;
        const costPln = (row.pos.costPln * row.seedQty) / row.pos.quantity;
        seeded.push({
          kind: 'carry-in',
          datetime: row.datetime,
          key,
          quantity,
          costPerSharePln: costPln / quantity,
          costMissing: row.pos.costMissing,
          rateUnavailable: row.pos.rateUnavailable,
        });
      }
    }
  }
  return seeded;
}

function processAction(args: {
  action: EnrichedCorporateAction;
  lotQueues: Map<string, FifoLot[]>;
  results: TradeResult[];
  taxPeriod: TaxPeriod;
  symbolCountryMap: Map<string, string>;
}): void {
  const { action, lotQueues } = args;
  const key = lotKey(action);
  const lots = lotQueues.get(key);

  if (!lots || lots.length === 0) return;

  if (action.type === 'stock-split') {
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
    if (
      mergerResult.newLots.length > 0 &&
      (action.targetIsin ?? action.targetSymbol)
    ) {
      const targetKey = (
        action.targetIsin ??
        action.targetSymbol ??
        ''
      ).toUpperCase();
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
        ...(mergerResult.costMissing ? { costBasisMissing: true } : {}),
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
}): void {
  const { trade, lotQueues, results, taxPeriod } = args;
  const key = lotKey(trade);
  const lots = getOrCreateLots(lotQueues, key);

  if (trade.type === 'buy') {
    const costPerSharePln = trade.price * trade.exchangeRate;
    const commissionPln = trade.commission * trade.commissionExchangeRate;
    const commissionPerSharePln =
      trade.quantity > 0 ? commissionPln / trade.quantity : 0;

    lots.push({
      quantity: trade.quantity,
      costPerSharePln,
      commissionPerSharePln,
      rateUnavailable: trade.rateUnavailable,
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

    if (lots.length === 0) {
      throw new Error(
        `No buy lots available for ${trade.symbol} (${trade.isin ?? 'no ISIN'}) on ${trade.datetime.toISOString()}. Cannot sell ${String(trade.quantity)} shares.`,
      );
    }

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
      throw new Error(
        `Insufficient buy lots for ${trade.symbol} (${trade.isin ?? 'no ISIN'}) on ${trade.datetime.toISOString()}. Short ${String(remainingQty)} shares.`,
      );
    }

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
