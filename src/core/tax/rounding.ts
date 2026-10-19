/** Round to full PLN (art. 63 § 1 Ordynacji podatkowej) */
export function roundToFullPln(args: { amount: number }): number {
  return Math.round(args.amount);
}

/** Round up to full grosz (art. 63 § 1a Ordynacji podatkowej) */
export function roundToGroszUp(args: { amount: number }): number {
  return Math.ceil(+(args.amount * 100).toFixed(10)) / 100;
}

/**
 * Round down to full grosz. Used for caps that must never be exceeded (e.g. the
 * 50% loss carry-forward limit, art. 9 ust. 3 updof).
 */
export function floorToGrosz(args: { amount: number }): number {
  return Math.floor(+(args.amount * 100).toFixed(10)) / 100;
}

/** Round to nearest grosz for form amounts stored with zł/gr precision. */
export function roundToGrosz(args: { amount: number }): number {
  return Math.round((args.amount + Number.EPSILON) * 100) / 100;
}
