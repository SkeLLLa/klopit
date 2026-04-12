/** Round to full PLN (art. 63 § 1 Ordynacji podatkowej) */
export function roundToFullPln(args: { amount: number }): number {
  return Math.round(args.amount);
}

/** Round up to full grosz (art. 63 § 1a Ordynacji podatkowej) */
export function roundToGroszUp(args: { amount: number }): number {
  return Math.ceil(+(args.amount * 100).toFixed(10)) / 100;
}
