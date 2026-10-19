import type { Pit38Fields } from '../types.js';

/** OPP rate under art. 45c updof: 1.5% = 15 / 1000. */
export const OPP_RATE_PER_MILLE = 15;

/**
 * Max OPP amount (PIT-38(18) poz. 67, art. 45c ust. 1 updof): 1.5% of (poz. 35 +
 * poz. 45), rounded DOWN to full 10 groszy, in integer units of 10 groszy
 * (exact integer arithmetic, no float rounding error).
 */
export function oppAmountTenGrosze(args: { taxDuePln: number }): number {
  // Work in whole grosze. Inputs are whole PLN per art. 63 Ordynacji, but be defensive.
  const grosze = Math.round(Math.max(args.taxDuePln, 0) * 100);
  // 1.5% of G grosze = 15*G/1000 grosze = 15*G/10000 tens of grosze
  return Math.floor((grosze * OPP_RATE_PER_MILLE) / 10_000);
}

/**
 * Max OPP amount (PIT-38(18) poz. 67) in PLN with at most one decimal (e.g.
 * 2.7). See {@link oppAmountTenGrosze}.
 */
export function oppAmountPln(args: { taxDuePln: number }): number {
  return oppAmountTenGrosze(args) / 10;
}

/** OPP base per PIT-38(18) objaśnienia: sum of poz. 35 and poz. 45. */
export function oppTaxDueBase(args: { pit38: Pit38Fields }): number {
  return args.pit38[35] + args.pit38[45];
}
