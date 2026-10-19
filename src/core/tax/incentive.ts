import type { EnrichedTrade } from '../types.js';

/** A buy lot of employee-incentive shares (RSU / ESPP). */
export function isIncentiveBuy(
  trade: Pick<EnrichedTrade, 'type' | 'source'>,
): boolean {
  return (
    trade.type === 'buy' && (trade.source === 'rsu' || trade.source === 'espp')
  );
}

/**
 * Extra cost of an incentive buy lot on top of the price paid and commission
 * (art. 23 ust. 1 pkt 38 updof).
 *
 * - `qualifying` (art. 24 ust. 11-12b): nothing was taxed, cost = price paid.
 * - `taxed-at-acquisition`: the income already taxed — `taxedIncomePln`, else
 *   (FMV − price) × quantity at the vest-date NBP rate. Neither available →
 *   missing.
 * - No regime chosen: cost = price paid, flagged missing (no default regime).
 */
export function incentiveExtraCost(trade: EnrichedTrade): {
  /** Total PLN added to the lot's cost. */
  extraCostPln: number;
  costMissing: boolean;
  /** The vest-date NBP rate the income needs could not be fetched. */
  rateUnavailable: boolean;
} {
  const { incentive } = trade;
  if (incentive?.regime === 'qualifying') {
    return { extraCostPln: 0, costMissing: false, rateUnavailable: false };
  }
  if (incentive?.regime !== 'taxed-at-acquisition') {
    return { extraCostPln: 0, costMissing: true, rateUnavailable: false };
  }
  if (incentive.taxedIncomePln !== undefined) {
    return {
      extraCostPln: incentive.taxedIncomePln,
      costMissing: false,
      rateUnavailable: false,
    };
  }
  if (incentive.fmvPerShare !== undefined) {
    // Without settlement-date rates `exchangeRate` is the vest-date rate.
    // With them, a missing vest-date rate must not fall back to it.
    if (trade.incomeRateUnavailable) {
      return { extraCostPln: 0, costMissing: false, rateUnavailable: true };
    }
    const perShare = Math.max(incentive.fmvPerShare - trade.price, 0);
    return {
      extraCostPln:
        perShare *
        trade.quantity *
        (trade.incomeExchangeRate ?? trade.exchangeRate),
      costMissing: false,
      rateUnavailable: false,
    };
  }
  return { extraCostPln: 0, costMissing: true, rateUnavailable: false };
}
