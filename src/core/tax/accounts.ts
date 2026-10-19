import type {
  EnrichedCarryInPosition,
  EnrichedCorporateAction,
  EnrichedTrade,
} from '../types.js';
import type { CarryInWarning } from './capital-gains.js';

/**
 * Account of rows without one when they cannot be matched to a single account.
 * Not a valid `<broker>:<id>` account, so it cannot collide with a real one.
 */
export const UNASSIGNED_ACCOUNT = '__unassigned__';

export function instrumentBase(args: {
  isin?: string;
  symbol: string;
}): string {
  return (args.isin ?? args.symbol).toUpperCase();
}

/** FIFO queue key: art. 24 ust. 10 updof keeps one queue per account. */
export function queueKey(
  account: string,
  base: string,
  lotId?: string,
): string {
  return `${account}|${lotId ? `${base}::${lotId}` : base}`;
}

/**
 * Every name a row's instrument goes by: its symbol and ISIN, plus the ISIN
 * (symbol) other rows pair with that symbol (ISIN). Brokers key the same
 * instrument differently (IBKR by ISIN, Schwab by symbol).
 */
export function instrumentNames(
  row: { isin?: string; symbol: string },
  symbolToIsin: Map<string, string>,
): Set<string> {
  const names = new Set<string>([row.symbol.toUpperCase()]);
  const isin = (
    row.isin ?? symbolToIsin.get(row.symbol.toUpperCase())
  )?.toUpperCase();
  if (isin) {
    names.add(isin);
    for (const [symbol, mapped] of symbolToIsin) {
      if (mapped.toUpperCase() === isin) names.add(symbol.toUpperCase());
    }
  }
  return names;
}

/**
 * Rows without an account join the only account of the session. With several
 * accounts they join the single account that holds the instrument; if none or
 * several do, they go to `unassigned` (warned; it drafts the form only when
 * several accounts hold the instrument).
 */
export function assignAccounts(args: {
  trades: EnrichedTrade[];
  corporateActions: EnrichedCorporateAction[];
  carryInPositions: EnrichedCarryInPosition[];
  symbolToIsin: Map<string, string>;
}): {
  trades: EnrichedTrade[];
  carryInPositions: EnrichedCarryInPosition[];
  accounts: string[];
  warnings: CarryInWarning[];
} {
  const { symbolToIsin } = args;
  const distinct = new Set<string>();
  for (const row of [
    ...args.trades,
    ...args.carryInPositions,
    ...args.corporateActions,
  ]) {
    if (row.account) distinct.add(row.account);
  }

  const holders = new Map<string, Set<string>>();
  if (distinct.size > 1) {
    for (const row of [...args.trades, ...args.carryInPositions]) {
      if (!row.account) continue;
      const names = holders.get(row.account) ?? new Set<string>();
      for (const name of instrumentNames(row, symbolToIsin)) names.add(name);
      holders.set(row.account, names);
    }
  }

  const single = [...distinct][0] ?? '';
  const unassigned = new Map<
    string,
    { symbol: string; isin?: string; overlap: boolean }
  >();
  const resolve = (row: {
    account?: string;
    isin?: string;
    symbol: string;
  }): string => {
    if (row.account) return row.account;
    if (distinct.size <= 1) return single;
    const names = instrumentNames(row, symbolToIsin);
    const matching = [...holders]
      .filter(([, held]) => [...names].some((name) => held.has(name)))
      .map(([account]) => account);
    if (matching.length === 1) return matching[0];
    const base = instrumentBase(row);
    const known = unassigned.get(base);
    unassigned.set(base, {
      symbol: row.symbol,
      isin: row.isin,
      overlap: (known?.overlap ?? false) || matching.length > 1,
    });
    return UNASSIGNED_ACCOUNT;
  };

  const trades = args.trades.map((t) => ({ ...t, account: resolve(t) }));
  const carryInPositions = args.carryInPositions.map((c) => ({
    ...c,
    account: resolve(c),
  }));
  const accounts = [
    ...new Set([
      ...trades.map((t) => t.account),
      ...carryInPositions.map((c) => c.account),
    ]),
  ].toSorted();
  const warnings = [...unassigned.values()].map((u): CarryInWarning => ({
    kind: 'account-unassigned',
    ...u,
  }));
  return { trades, carryInPositions, accounts, warnings };
}

/**
 * Queues a corporate action touches. A scoped action hits its own account only;
 * an unscoped one (legacy rows, manual "all accounts") hits every account.
 */
export function actionTargets(
  action: EnrichedCorporateAction,
  accounts: readonly string[],
): { account: string; key: string }[] {
  const base = instrumentBase(action);
  return (action.account ? [action.account] : accounts).map((account) => ({
    account,
    key: queueKey(account, base),
  }));
}

function localDay(date: Date): string {
  return `${String(date.getFullYear())}-${String(date.getMonth())}-${String(date.getDate())}`;
}

/**
 * Split de-duplication: the same split reported twice (two brokers, or a manual
 * entry dated at midnight next to a timestamped import) applies once per queue.
 * Two splits count as the same when they share the local calendar day and the
 * ratio. Returns true the first time a split is seen on a queue.
 */
export function createSplitDeduper(): (
  key: string,
  action: EnrichedCorporateAction,
) => boolean {
  const seen = new Set<string>();
  return (key, action) => {
    const signature = `${key}|${localDay(action.datetime)}|${String(action.numerator / action.denominator)}`;
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  };
}
