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
 * Instrument identity across brokers: the ISIN (known or paired), else the
 * symbol.
 */
export function instrumentGroup(
  row: { isin?: string; symbol: string },
  symbolToIsin: Map<string, string>,
): string {
  return (
    row.isin ??
    symbolToIsin.get(row.symbol.toUpperCase()) ??
    row.symbol
  ).toUpperCase();
}

/** Unstamped rows of one instrument in a session with several accounts. */
export interface UnstampedGroup {
  symbol: string;
  isin?: string;
  /** Accounts whose own rows name the instrument. */
  candidates: string[];
  rows: number;
}

/** Where a group's unstamped rows go: `account`, or stay `unassigned`. */
export interface JoinDecision {
  account?: string;
  overlap: boolean;
}

/**
 * Decide, per instrument, whether unstamped rows join a stamped account. They
 * join only when that resolves a shortfall found with them in their own queue:
 * an account ran short and they fill it, or they ran short and the account
 * covers them. Consistent on their own, they stay apart (guessing an account
 * could silently turn a correct cost into a wrong final one). Several possible
 * accounts keep them unassigned and `overlap` drafts the form.
 */
export function decideJoins(
  groups: Map<string, UnstampedGroup>,
  shortfalls: { account: string; group: string }[],
): Map<string, JoinDecision> {
  const decisions = new Map<string, JoinDecision>();
  for (const [group, info] of groups) {
    const mine = shortfalls.filter((s) => s.group === group);
    const unassignedShort = mine.some((s) => s.account === UNASSIGNED_ACCOUNT);
    const shortAccounts = new Set(
      mine
        .filter((s) => s.account !== UNASSIGNED_ACCOUNT)
        .map((s) => s.account),
    );
    const resolvers = unassignedShort
      ? info.candidates
      : info.candidates.filter((account) => shortAccounts.has(account));
    if (resolvers.length === 1) {
      decisions.set(group, { account: resolvers[0], overlap: false });
    } else {
      decisions.set(group, { overlap: resolvers.length > 1 });
    }
  }
  return decisions;
}

/**
 * Rows without an account join the only account of the session. With several
 * accounts they go to `unassigned` unless `decisions` joins their instrument to
 * an account (see `decideJoins`). Warnings: `account-unassigned` for the ones
 * left apart, `account-assumed` for the joined ones.
 */
export function assignAccounts(args: {
  trades: EnrichedTrade[];
  corporateActions: EnrichedCorporateAction[];
  carryInPositions: EnrichedCarryInPosition[];
  symbolToIsin: Map<string, string>;
  decisions?: Map<string, JoinDecision>;
}): {
  trades: EnrichedTrade[];
  carryInPositions: EnrichedCarryInPosition[];
  accounts: string[];
  warnings: CarryInWarning[];
  unstamped: Map<string, UnstampedGroup>;
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
  const unstamped = new Map<string, UnstampedGroup>();
  const resolve = (row: {
    account?: string;
    isin?: string;
    symbol: string;
  }): string => {
    if (row.account) return row.account;
    if (distinct.size <= 1) return single;
    const group = instrumentGroup(row, symbolToIsin);
    const known = unstamped.get(group);
    if (known) {
      known.rows += 1;
      known.isin ??= row.isin;
    } else {
      const names = instrumentNames(row, symbolToIsin);
      unstamped.set(group, {
        symbol: row.symbol,
        isin: row.isin,
        candidates: [...holders]
          .filter(([, held]) => [...names].some((name) => held.has(name)))
          .map(([account]) => account),
        rows: 1,
      });
    }
    return args.decisions?.get(group)?.account ?? UNASSIGNED_ACCOUNT;
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
  const warnings = [...unstamped].map(([group, u]): CarryInWarning => {
    const decision = args.decisions?.get(group);
    return decision?.account
      ? {
          kind: 'account-assumed',
          symbol: u.symbol,
          isin: u.isin,
          account: decision.account,
          rows: u.rows,
        }
      : {
          kind: 'account-unassigned',
          symbol: u.symbol,
          isin: u.isin,
          overlap: decision?.overlap ?? false,
        };
  });
  return { trades, carryInPositions, accounts, warnings, unstamped };
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
