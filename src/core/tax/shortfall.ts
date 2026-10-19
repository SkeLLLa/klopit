import type { EnrichedTrade } from '../types.js';
import {
  instrumentBase,
  instrumentNames,
  queueKey,
  UNASSIGNED_ACCOUNT,
} from './accounts.js';
import type { CarryInWarning } from './capital-gains.js';

/** A sell that exceeded the shares its account held. */
export interface ShortfallRequest {
  trade: EnrichedTrade;
  missing: number;
}

const EPS = 1e-9;

/**
 * Explain sells of shares an account does not hold: another account that held
 * the instrument then (a transfer is likely), else a missing carry-in. One
 * warning per (account, instrument, kind) with summed quantities and the
 * earliest date. Nothing is moved; sells in the `unassigned` account are left
 * to the `account-unassigned` warning.
 *
 * `holdingsAtTimes` replays the timeline once for all request times.
 */
export function shortfallWarnings(args: {
  requests: ShortfallRequest[];
  accounts: readonly string[];
  symbolToIsin: Map<string, string>;
  holdingsAtTimes: (times: number[]) => Map<number, Map<string, number>>;
}): CarryInWarning[] {
  const requests = args.requests.filter(
    (r) => r.trade.account !== UNASSIGNED_ACCOUNT,
  );
  if (requests.length === 0) return [];
  const snapshots = args.holdingsAtTimes([
    ...new Set(requests.map((r) => r.trade.datetime.getTime())),
  ]);

  const warnings = new Map<string, CarryInWarning>();
  const allocated = new Map<string, number>();
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

  for (const { trade, missing: total } of requests) {
    const account = trade.account ?? '';
    const names = instrumentNames(trade, args.symbolToIsin);
    const base = instrumentBase(trade);
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
          available: held - (allocated.get(`${other}|${base}`) ?? 0),
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
        `${donor.account}|${base}`,
        (allocated.get(`${donor.account}|${base}`) ?? 0) + quantity,
      );
      add(
        `transfer|${donor.account}|${account}|${base}`,
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
      add(
        `carry|${account}|${base}`,
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
  return [...warnings.values()];
}
