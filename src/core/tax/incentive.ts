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
 *   (FMV − price) × quantity at the buy-date rate. Neither available →
 *   missing.
 * - No regime chosen: cost = price paid, flagged missing (no default regime).
 */
export function incentiveExtraCost(trade: EnrichedTrade): {
  /** Total PLN added to the lot's cost. */
  extraCostPln: number;
  costMissing: boolean;
} {
  const { incentive } = trade;
  if (incentive?.regime === 'qualifying') {
    return { extraCostPln: 0, costMissing: false };
  }
  if (incentive?.regime !== 'taxed-at-acquisition') {
    return { extraCostPln: 0, costMissing: true };
  }
  if (incentive.taxedIncomePln !== undefined) {
    return { extraCostPln: incentive.taxedIncomePln, costMissing: false };
  }
  if (incentive.fmvPerShare !== undefined) {
    const perShare = Math.max(incentive.fmvPerShare - trade.price, 0);
    return {
      extraCostPln: perShare * trade.quantity * trade.exchangeRate,
      costMissing: false,
    };
  }
  return { extraCostPln: 0, costMissing: true };
}
