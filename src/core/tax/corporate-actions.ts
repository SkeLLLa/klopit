/** A single FIFO lot in the buy queue */
export interface FifoLot {
  quantity: number;
  costPerSharePln: number;
  commissionPerSharePln: number;
  /** The buy that created this lot had no NBP rate; its cost was counted as 0. */
  rateUnavailable?: boolean;
  /** Lot comes from a carry-in position with no known acquisition cost. */
  costMissing?: boolean;
}

/** Result of applying a merger to lots */
export interface MergerResult {
  newLots: FifoLot[];
  cashProceeds: number;
  cashCostPln: number;
  cashCurrency: string;
  /** At least one input lot had no NBP rate (its cost was counted as 0). */
  costRateUnavailable: boolean;
  /** Any consumed lot had no known acquisition cost. */
  costMissing?: boolean;
}

/**
 * Apply a stock split to all lots for a symbol. Returns a new array — does not
 * mutate the input.
 *
 * - Forward split (e.g. 10:1): numerator=10, denominator=1 → factor=10
 * - Reverse split (e.g. 1:3): numerator=1, denominator=3 → factor=1/3
 */
export function applyStockSplit(args: {
  lots: FifoLot[];
  numerator: number;
  denominator: number;
}): FifoLot[] {
  if (args.denominator === 0) {
    throw new Error('Stock split denominator cannot be zero');
  }

  const factor = args.numerator / args.denominator;

  if (factor === 0) {
    throw new Error('Stock split factor cannot be zero');
  }

  if (factor === 1) {
    return args.lots.map((lot) => ({ ...lot }));
  }

  return args.lots.map((lot) => ({
    quantity: lot.quantity * factor,
    costPerSharePln: lot.costPerSharePln / factor,
    commissionPerSharePln: lot.commissionPerSharePln / factor,
    rateUnavailable: lot.rateUnavailable,
    ...(lot.costMissing ? { costMissing: true } : {}),
  }));
}

/**
 * Apply a cash-and-stock merger to lots.
 *
 * The cash portion is a partial disposition (taxable event). Cost basis is
 * allocated proportionally between cash and stock components based on their
 * fair market values. The remaining cost transfers to new lots.
 *
 * Based on art. 24 ust. 8 ustawy o PIT.
 */
export function applyMerger(args: {
  lots: FifoLot[];
  conversionRatio: number;
  cashPerShare: number;
  cashCurrency: string;
  cashExchangeRate: number;
  /** FMV of new shares received (total, in original currency) */
  newSharesValue?: number;
}): MergerResult {
  if (args.lots.length === 0) {
    return {
      newLots: [],
      cashProceeds: 0,
      cashCostPln: 0,
      cashCurrency: args.cashCurrency,
      costRateUnavailable: false,
    };
  }

  const costRateUnavailable = args.lots.some((lot) => lot.rateUnavailable);
  const totalOldQty = args.lots.reduce((sum, lot) => sum + lot.quantity, 0);

  const totalCostPln = args.lots.reduce(
    (sum, lot) =>
      sum + lot.quantity * (lot.costPerSharePln + lot.commissionPerSharePln),
    0,
  );

  const costMissing = args.lots.some((lot) => lot.costMissing === true);
  const missingFlag = costMissing ? { costMissing: true } : {};

  const cashProceeds = totalOldQty * args.cashPerShare;
  const totalNewQty = totalOldQty * args.conversionRatio;

  // Proportional cost allocation based on FMV of each component.
  // cashFraction = cashProceeds / (cashProceeds + newSharesValue)
  // Fallback: if newSharesValue is missing and there IS cash, allocate
  // full cost to cash (conservative — all cash treated as income).
  let cashFraction: number;
  if (cashProceeds === 0) {
    cashFraction = 0;
  } else if (args.newSharesValue !== undefined && args.newSharesValue > 0) {
    cashFraction = cashProceeds / (cashProceeds + args.newSharesValue);
  } else {
    cashFraction = 1;
  }

  const allocatedCashCostPln = totalCostPln * cashFraction;
  const remainingCostPln = totalCostPln - allocatedCashCostPln;

  if (totalNewQty === 0) {
    // Cash-only buyout — no new shares, all cost allocated to cash
    return {
      newLots: [],
      cashProceeds,
      cashCostPln: totalCostPln,
      cashCurrency: args.cashCurrency,
      costRateUnavailable,
      ...missingFlag,
    };
  }

  return {
    newLots: [
      {
        quantity: totalNewQty,
        costPerSharePln: remainingCostPln / totalNewQty,
        commissionPerSharePln: 0,
        rateUnavailable: costRateUnavailable,
        ...missingFlag,
      },
    ],
    cashProceeds,
    cashCostPln: allocatedCashCostPln,
    cashCurrency: args.cashCurrency,
    costRateUnavailable,
    ...missingFlag,
  };
}
