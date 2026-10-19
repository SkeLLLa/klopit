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
 * Connected components of instruments: names that trade, carry-in and
 * corporate-action rows tie together (symbol <-> ISIN, merger targets). FIFO
 * lots flow only inside a component, so a dry run needs nothing outside it.
 * Returns the component id of a row.
 */
export function createComponents(args: {
  trades: readonly { isin?: string; symbol: string }[];
  carryInPositions: readonly { isin?: string; symbol: string }[];
  corporateActions: readonly {
    isin?: string;
    symbol: string;
    targetIsin?: string;
    targetSymbol?: string;
  }[];
  symbolToIsin: Map<string, string>;
}): (row: { isin?: string; symbol: string }) => string {
  const parent = new Map<string, string>();
  const find = (name: string): string => {
    let root = name;
    for (let next = parent.get(root); next; next = parent.get(root)) {
      if (next === root) break;
      root = next;
    }
    parent.set(name, root);
    return root;
  };
  const union = (names: (string | undefined)[]) => {
    const upper = names
      .filter((n): n is string => !!n)
      .map((n) => n.toUpperCase());
    for (const name of upper) if (!parent.has(name)) parent.set(name, name);
    for (const name of upper.slice(1)) parent.set(find(name), find(upper[0]));
  };
  const withIsin = (row: { isin?: string; symbol: string }) =>
    row.isin ?? args.symbolToIsin.get(row.symbol.toUpperCase());
  for (const row of [...args.trades, ...args.carryInPositions]) {
    union([row.symbol, withIsin(row)]);
  }
  for (const action of args.corporateActions) {
    union([
      action.symbol,
      withIsin(action),
      action.targetSymbol,
      action.targetIsin ??
        (action.targetSymbol
          ? args.symbolToIsin.get(action.targetSymbol.toUpperCase())
          : undefined),
    ]);
  }
  return (row) => find(row.symbol.toUpperCase());
}

/** What a dry run says about a component of instruments. */
export interface ComponentStats {
  /** Shares sold that no lot covered. */
  shortfall: number;
  shortfallByAccount: Map<string, number>;
  /** In-period sell results, comparable between runs. */
  signature: string;
}

const EPS = 1e-9;

/**
 * Decide, per instrument, what happens to rows without an account. Any
 * attribution is a guess (art. 24 ust. 10 updof), so a result is final only
 * when the guess cannot matter:
 *
 * - A candidate account takes the rows when joining it lowers the component's
 *   total shortfall and adds none to that account (checked by a dry run).
 *   Exactly one such account: join it (`account-assumed`).
 * - Otherwise, if no shortfall exists and joining any candidate leaves the
 *   in-period sells of the component unchanged, they stay apart and final.
 * - Anything else (several resolving accounts, no resolving account, or a choice
 *   that changes the result) stays unassigned and drafts the form. Instruments
 *   no account holds stay apart (nothing to confuse them with). A component is
 *   an instrument plus whatever mergers tie to it, so a join that only shows up
 *   after a merger is seen too.
 */
export function decideJoins(
  groups: Map<string, UnstampedGroup>,
  evaluate: (group: string, account?: string) => ComponentStats,
): Map<string, JoinDecision> {
  const decisions = new Map<string, JoinDecision>();
  for (const [group, info] of groups) {
    if (info.candidates.length === 0) {
      decisions.set(group, { overlap: false });
      continue;
    }
    const apart = evaluate(group);
    const joined = info.candidates.map((account) => ({
      account,
      stats: evaluate(group, account),
    }));
    if (apart.shortfall > EPS) {
      const resolvers = joined.filter(
        ({ account, stats }) =>
          stats.shortfall < apart.shortfall - EPS &&
          (stats.shortfallByAccount.get(account) ?? 0) <=
            (apart.shortfallByAccount.get(account) ?? 0) + EPS,
      );
      decisions.set(
        group,
        resolvers.length === 1
          ? { account: resolvers[0].account, overlap: false }
          : { overlap: true },
      );
    } else {
      const same = joined.every(
        ({ stats }) =>
          stats.shortfall <= EPS && stats.signature === apart.signature,
      );
      decisions.set(group, { overlap: !same });
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
