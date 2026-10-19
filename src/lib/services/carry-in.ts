import type { CarryInWarning } from '../../core/tax/capital-gains.js';
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
  if (pos.costBasis !== undefined) return false;
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
      if (pos.costBasis !== undefined) {
        // PLN cost (a cost without a currency is PLN)
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

export type CarryInValidationCode =
  | 'symbol-required'
  | 'quantity-invalid'
  | 'year-invalid'
  | 'year-not-prior'
  | 'date-after-year'
  | 'cost-invalid'
  | 'date-required-for-fx';

/** Carry-in input rejected by {@link normalizeCarryInPosition}. */
export class CarryInValidationError extends Error {
  readonly code: CarryInValidationCode;
  constructor(code: CarryInValidationCode) {
    super(`Invalid carry-in position: ${code}`);
    this.name = 'CarryInValidationError';
    this.code = code;
  }
}

/**
 * Parse a user-typed decimal ("1 234,5", "1234.5") or a value from a number
 * input (`number | null`). Empty input is `undefined`; garbage is `NaN`.
 */
export function parseDecimalInput(
  value: string | number | null | undefined,
): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return value;
  const text = value.replaceAll(/\s/g, '').replace(',', '.');
  if (text === '') return undefined;
  return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(text) ? Number(text) : Number.NaN;
}

/**
 * Validate and normalize a complete carry-in position.
 *
 * - `year` must be before the session tax year (a carry-in is the position held
 *   at the end of a prior year) and `acquisitionDate` must not be after Dec 31
 *   of `year`.
 * - A cost without a currency is in PLN.
 * - A foreign-currency cost needs an acquisition date: the NBP rate is taken from
 *   the business day before acquisition (art. 11a ust. 2 updof).
 * - `costBasisSource` follows the data: `user` when a cost is set, otherwise
 *   `zero-confirmed` if the user confirmed zero, else `missing`.
 */
export function normalizeCarryInPosition<T extends CarryInPosition>(
  pos: T,
  opts: { sessionYear?: number } = {},
): T {
  const symbol = pos.symbol.trim().toUpperCase();
  if (!symbol) throw new CarryInValidationError('symbol-required');
  if (!(pos.quantity > 0)) {
    throw new CarryInValidationError('quantity-invalid');
  }
  if (!Number.isInteger(pos.year) || pos.year < 1900) {
    throw new CarryInValidationError('year-invalid');
  }
  if (opts.sessionYear !== undefined && pos.year >= opts.sessionYear) {
    throw new CarryInValidationError('year-not-prior');
  }
  if (pos.acquisitionDate !== undefined) {
    const time = pos.acquisitionDate.getTime();
    if (Number.isNaN(time) || pos.acquisitionDate.getFullYear() > pos.year) {
      throw new CarryInValidationError('date-after-year');
    }
  }
  for (const value of [pos.costBasis, pos.costBasisPln]) {
    if (value !== undefined && !(value >= 0)) {
      throw new CarryInValidationError('cost-invalid');
    }
  }
  const typedCurrency = pos.currency?.trim().toUpperCase() || undefined;
  const currency =
    pos.costBasis === undefined ? typedCurrency : (typedCurrency ?? 'PLN');
  if (
    pos.costBasis !== undefined &&
    pos.costBasisPln === undefined &&
    currency !== 'PLN' &&
    pos.acquisitionDate === undefined
  ) {
    throw new CarryInValidationError('date-required-for-fx');
  }
  const hasCost = pos.costBasis !== undefined || pos.costBasisPln !== undefined;
  let costBasisSource: CarryInPosition['costBasisSource'] = 'missing';
  if (hasCost) costBasisSource = 'user';
  else if (pos.costBasisSource === 'zero-confirmed') {
    costBasisSource = 'zero-confirmed';
  }
  return { ...pos, symbol, currency, costBasisSource };
}

/**
 * True when the last calculation did not use this carry-in row: imported trades
 * fully explained its snapshot, or the snapshot contradicted them. Such rows
 * need no acquisition cost.
 */
export function isCarryInIgnored(
  row: CarryInPosition,
  warnings: readonly CarryInWarning[],
): boolean {
  return warnings.some((w) => {
    if (
      (w.kind !== 'carry-in-overlap' && w.kind !== 'carry-in-inconsistent') ||
      w.year !== row.year ||
      (w.account && row.account && w.account !== row.account)
    ) {
      return false;
    }
    const sameInstrument =
      row.isin && w.isin
        ? row.isin.toUpperCase() === w.isin.toUpperCase()
        : row.symbol.toUpperCase() === w.symbol.toUpperCase();
    if (!sameInstrument) return false;
    return (
      w.kind === 'carry-in-inconsistent' ||
      w.coveredQuantity >= w.carryInQuantity * (1 - 1e-9)
    );
  });
}
