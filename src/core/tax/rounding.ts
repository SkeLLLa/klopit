/**
 * Round to full PLN, half up (art. 63 § 1 OP): under 50 gr is dropped, 50 gr
 * and over is rounded up. Amounts are non-negative.
 */
export function roundToFullPln(args: { amount: number }): number {
  return Math.round(+args.amount.toFixed(10));
}

/**
 * Round up to full grosz (art. 63 § 1a OP — art. 30a ust. 1 pkt 1–3 (interest)
 * only)
 */
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
  return Math.round(+(args.amount * 100).toFixed(10)) / 100;
}
