import type { CorporateAction } from '../types.js';
import { instrumentNames, queueKey } from './accounts.js';
import type { FifoLot } from './corporate-actions.js';

/**
 * Queues a transfer draws from: every queue of its instrument in the source
 * account, including IBI lot-id queues (`<base>::<lotId>`), whichever name
 * (symbol or ISIN) the account keys the instrument by.
 */
export function transferSourceKeys(args: {
  keys: Iterable<string>;
  action: Pick<CorporateAction, 'symbol' | 'isin' | 'fromAccount'>;
  symbolToIsin: Map<string, string>;
}): string[] {
  const prefixes = [...instrumentNames(args.action, args.symbolToIsin)].map(
    (name) => queueKey(args.action.fromAccount ?? '', name),
  );
  return [...args.keys]
    .filter((key) =>
      prefixes.some(
        (prefix) => key === prefix || key.startsWith(`${prefix}::`),
      ),
    )
    .toSorted();
}

/**
 * Queue the moved lots join: the key the destination's own trades use (ISIN
 * when its rows carry one, else the symbol). Never a lot-id queue: a lot id
 * only pairs IBI buys with their own sells.
 */
export function transferDestKey(args: {
  action: Pick<CorporateAction, 'symbol' | 'toAccount'>;
  /** Symbol -> ISIN of the destination account. */
  symbolToIsin: Map<string, string>;
}): string {
  const symbol = args.action.symbol.toUpperCase();
  return queueKey(
    args.action.toAccount ?? '',
    (args.symbolToIsin.get(symbol) ?? symbol).toUpperCase(),
  );
}

/** Acquisition time for ordering: a lot with no date counts as the oldest. */
function acquiredTime(lot: FifoLot): number {
  return lot.acquiredAt?.getTime() ?? Number.NEGATIVE_INFINITY;
}

/** Insert `lot` after the lots acquired no later than it (FIFO by buy date). */
function insertByAcquiredAt(lots: FifoLot[], lot: FifoLot): void {
  const acquired = acquiredTime(lot);
  const at = lots.findIndex((other) => acquiredTime(other) > acquired);
  if (at < 0) lots.push(lot);
  else lots.splice(at, 0, lot);
}

/**
 * Move `quantity` shares, oldest lot first, out of the source queues into the
 * destination queue. A lot keeps its cost, flags and acquisition date; only its
 * queue changes, so IBI lot ids end here. Source queues are merged by
 * acquisition date (each stays in its own order). Returns the shares moved and
 * the shares the sources lacked.
 */
export function moveLots(args: {
  lotQueues: Map<string, FifoLot[]>;
  sourceKeys: readonly string[];
  destKey: string;
  quantity: number;
  /** Transfer time (ms): lots protected up to then stay where they are. */
  at: number;
  /** Quantity below which a remainder counts as float residue. */
  epsilon: number;
}): { moved: number; missing: number } {
  const { lotQueues, epsilon } = args;
  const movable = (lot: FifoLot) =>
    lot.protectedUntil === undefined || lot.protectedUntil < args.at;
  const sources = args.sourceKeys
    .map((key) => lotQueues.get(key))
    .filter((lots): lots is FifoLot[] => !!lots && lots.length > 0);
  const taken: FifoLot[] = [];
  let remaining = args.quantity;

  while (remaining > epsilon) {
    let oldest: FifoLot[] | undefined;
    let oldestAt = 0;
    for (const lots of sources) {
      const first = lots.find(movable);
      if (!first) continue;
      if (!oldest || acquiredTime(first) < oldestAt) {
        oldest = lots;
        oldestAt = acquiredTime(first);
      }
    }
    if (!oldest) break;
    const index = oldest.findIndex(movable);
    const lot = oldest[index];
    const used = Math.min(remaining, lot.quantity);
    taken.push({ ...lot, quantity: used });
    remaining -= used;
    if (lot.quantity - used <= epsilon) oldest.splice(index, 1);
    else lot.quantity -= used;
  }

  if (taken.length > 0) {
    const dest = lotQueues.get(args.destKey) ?? [];
    lotQueues.set(args.destKey, dest);
    for (const lot of taken) insertByAcquiredAt(dest, lot);
  }
  const moved = args.quantity - Math.max(remaining, 0);
  return { moved, missing: remaining > epsilon ? remaining : 0 };
}
