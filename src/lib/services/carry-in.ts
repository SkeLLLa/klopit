import type {
  CarryInPosition,
  EnrichedCarryInPosition,
} from '../../core/types.js';

/**
 * Date whose NBP rate converts the carry-in cost (art. 11a ust. 2 updof: rate
 * from the last business day before the cost was incurred). Falls back to Dec
 * 31 of `year` when the acquisition date is unknown.
 */
export function carryInFxDate(pos: CarryInPosition): Date {
  return pos.acquisitionDate ?? new Date(pos.year, 11, 31);
}

/** Carry-in cost that must be converted at an NBP rate (non-PLN, no override). */
export function needsCarryInFx(
  pos: CarryInPosition,
): pos is CarryInPosition & { costBasis: number; currency: string } {
  return (
    pos.costBasisPln === undefined &&
    pos.costBasis !== undefined &&
    pos.currency !== undefined &&
    pos.currency !== '' &&
    pos.currency.toUpperCase() !== 'PLN'
  );
}

/**
 * True when no acquisition cost is known and zero cost was not explicitly
 * confirmed by the user. Such positions are calculated with cost 0 (the safe
 * direction: tax is overstated) but the result is flagged as not final.
 */
export function isCarryInCostMissing(pos: CarryInPosition): boolean {
  if (pos.costBasisPln !== undefined) return false;
  if (pos.costBasis !== undefined && pos.currency) return false;
  return pos.costBasisSource !== 'zero-confirmed';
}

/** Resolve each carry-in's acquisition cost to PLN. */
export async function enrichCarryInPositions<T extends CarryInPosition>(args: {
  positions: T[];
  /** Returns the NBP rate for the cost date, or undefined when unavailable. */
  getRate: (args: {
    currency: string;
    date: Date;
  }) => Promise<number | undefined>;
}): Promise<(T & EnrichedCarryInPosition)[]> {
  return Promise.all(
    args.positions.map(async (pos) => {
      if (pos.costBasisPln !== undefined) {
        return {
          ...pos,
          costPln: pos.costBasisPln,
          rateUnavailable: false,
          costMissing: false,
        };
      }
      if (needsCarryInFx(pos)) {
        const rate = await args.getRate({
          currency: pos.currency,
          date: carryInFxDate(pos),
        });
        return {
          ...pos,
          costPln: rate === undefined ? 0 : pos.costBasis * rate,
          rateUnavailable: rate === undefined,
          costMissing: false,
        };
      }
      if (pos.costBasis !== undefined && pos.currency) {
        // PLN cost
        return {
          ...pos,
          costPln: pos.costBasis,
          rateUnavailable: false,
          costMissing: false,
        };
      }
      return {
        ...pos,
        costPln: 0,
        rateUnavailable: false,
        costMissing: isCarryInCostMissing(pos),
      };
    }),
  );
}
