import type { EnrichedTrade } from '../types.js';
import {
  instrumentBase,
  instrumentGroup,
  instrumentNames,
  queueKey,
  UNASSIGNED_ACCOUNT,
} from './accounts.js';
import type { CarryInWarning } from './capital-gains.js';

/** A sell that exceeded the shares its account held. */
export interface ShortfallRequest {
  trade: EnrichedTrade;
  missing: number;
  /**
   * Parts of `missing` that a `transfer-shortfall` already explains, by the
   * transfer's source account. That account is not suggested as donor for them.
   * Other donors still count (the shares may have come from there), but their
   * warnings stay hidden up to the explained quantity.
   */
  explained?: { account: string; quantity: number }[] | undefined;
}

const EPS = 1e-9;

/**
 * Explain sells of shares an account does not hold: another account that held
 * the instrument then (a transfer is likely), else a missing carry-in. One
 * warning per (account, instrument, kind) with summed quantities and the
 * earliest date. Nothing is moved; sells in the `unassigned` account are left
 * to the `account-unassigned` warning.
 *
 * `holdingsAtTimes` replays the timeline once for all request times. `all` also
 * holds the parts a transfer shortfall explains (they still taint their
 * donors); `visible` is what to show.
 */
export function shortfallWarnings(args: {
  requests: ShortfallRequest[];
  accounts: readonly string[];
  symbolToIsin: Map<string, string>;
  holdingsAtTimes: (times: number[]) => Map<number, Map<string, number>>;
}): { all: CarryInWarning[]; visible: CarryInWarning[] } {
  const requests = args.requests.filter(
    (r) => r.trade.account !== UNASSIGNED_ACCOUNT,
  );
  if (requests.length === 0) return { all: [], visible: [] };
  const snapshots = args.holdingsAtTimes([
    ...new Set(requests.map((r) => r.trade.datetime.getTime())),
  ]);

  const warnings = new Map<string, CarryInWarning>();
  const allocated = new Map<string, number>();
  const hidden = new Map<string, number>();
  const add = (key: string, warning: CarryInWarning, quantity: number) => {
    const known = warnings.get(key);
    if (
      known &&
      (known.kind === 'transfer-suggested' ||
        known.kind === 'shortfall-add-carry-in') &&
      (warning.kind === 'transfer-suggested' ||
        warning.kind === 'shortfall-add-carry-in')
    ) {
      known.quantity += quantity;
      if (warning.before < known.before) known.before = warning.before;
    } else {
      warnings.set(key, warning);
    }
  };

  for (const { trade, missing: total, explained = [] } of requests) {
    let explainedLeft = explained.reduce((sum, e) => sum + e.quantity, 0);
    const explainedBy = new Map<string, number>();
    for (const e of explained) {
      explainedBy.set(
        e.account,
        (explainedBy.get(e.account) ?? 0) + e.quantity,
      );
    }
    const account = trade.account ?? '';
    const names = instrumentNames(trade, args.symbolToIsin);
    const base = instrumentBase(trade);
    // The donor's shares are one pool however the receivers key the instrument.
    const group = instrumentGroup(trade, args.symbolToIsin);
    const holdings =
      snapshots.get(trade.datetime.getTime()) ?? new Map<string, number>();
    const donors = args.accounts
      .filter((other) => other !== account && other !== UNASSIGNED_ACCOUNT)
      .map((other) => {
        const held = [...names].reduce(
          (sum, name) => sum + (holdings.get(queueKey(other, name)) ?? 0),
          0,
        );
        return {
          account: other,
          available:
            held -
            (allocated.get(`${other}|${group}`) ?? 0) -
            (explainedBy.get(other) ?? 0),
        };
      })
      .filter((donor) => donor.available > EPS)
      .toSorted((a, b) => b.available - a.available);

    let missing = total;
    for (const donor of donors) {
      if (missing <= EPS) break;
      const quantity = Math.min(missing, donor.available);
      missing -= quantity;
      allocated.set(
        `${donor.account}|${group}`,
        (allocated.get(`${donor.account}|${group}`) ?? 0) + quantity,
      );
      const hide = Math.min(quantity, explainedLeft);
      explainedLeft -= hide;
      const transferKey = `transfer|${donor.account}|${account}|${base}`;
      hidden.set(transferKey, (hidden.get(transferKey) ?? 0) + hide);
      add(
        transferKey,
        {
          kind: 'transfer-suggested',
          instrument: trade.symbol,
          isin: trade.isin,
          fromAccount: donor.account,
          toAccount: account,
          quantity,
          before: trade.datetime,
        },
        quantity,
      );
    }
    if (missing > EPS) {
      const hide = Math.min(missing, explainedLeft);
      const carryKey = `carry|${account}|${base}`;
      hidden.set(carryKey, (hidden.get(carryKey) ?? 0) + hide);
      add(
        carryKey,
        {
          kind: 'shortfall-add-carry-in',
          instrument: trade.symbol,
          isin: trade.isin,
          account,
          quantity: missing,
          before: trade.datetime,
        },
        missing,
      );
    }
  }
  const visible: CarryInWarning[] = [];
  for (const [key, warning] of warnings) {
    if (
      warning.kind !== 'transfer-suggested' &&
      warning.kind !== 'shortfall-add-carry-in'
    ) {
      visible.push(warning);
      continue;
    }
    const quantity = warning.quantity - (hidden.get(key) ?? 0);
    if (quantity > EPS) visible.push({ ...warning, quantity });
  }
  return { all: [...warnings.values()], visible };
}
