import { TAX_RATE } from '../types.js';

/**
 * Maximum creditable foreign withholding tax rate on dividends, per country of
 * the dividend-paying entity (ISO 3166-1 alpha-2). Sourced from Polish
 * double-tax treaties (UPO) in force as of 2026-04. Values are decimals
 * (0.15 = 15%).
 *
 * Countries not present in this map fall back to the domestic 19% cap from
 * art. 30a ust. 9 ustawy o PIT. Expand this map conservatively — a missing
 * entry over-credits at most by (19% − treaty rate) × gross dividend; a wrong
 * entry would under-credit real tax.
 *
 * Rates below are the "portfolio" (default) dividend rate — kloPIT targets
 * individual investors who virtually never hold ≥10% stakes that unlock the
 * reduced inter-company rates.
 *
 * Official treaty list (Ministerstwo Finansów):
 * https://www.podatki.gov.pl/podatkowa-wspolpraca-miedzynarodowa/wykaz-umow-o-unikaniu-podwojnego-opodatkowania/
 */
export const TREATY_DIVIDEND_RATE_MAP: ReadonlyMap<string, number> = new Map([
  ['US', 0.15], // UPO PL-USA 1974, art. 11 ust. 2 lit. b
  ['GB', 0.1], // UPO PL-UK 2006, art. 10 ust. 2 lit. b
  ['DE', 0.15], // UPO PL-DE 2003, art. 10 ust. 2 lit. b
  ['FR', 0.15], // UPO PL-FR 1975, art. 10 ust. 2 lit. b
  ['NL', 0.15], // UPO PL-NL 2002, art. 10 ust. 2 lit. b
  ['IE', 0.15], // UPO PL-IE 1995, art. 10 ust. 2 lit. b
  ['CH', 0.15], // UPO PL-CH 1991 (ze zmianami), art. 10 ust. 2 lit. b
  ['CA', 0.15], // UPO PL-CA 2012, art. 10 ust. 2 lit. b
  ['JP', 0.1], // UPO PL-JP 1980, art. 10 ust. 2 lit. b
  ['NO', 0.15], // UPO PL-NO 2009 (ze zm. 2012), art. 10 ust. 2 lit. b
]);

/**
 * Maximum creditable foreign withholding tax rate for a given issuer country.
 * Returns the treaty rate capped at the Polish domestic rate (19%). Unknown
 * countries fall back to the domestic rate — conservative default preserves
 * pre-treaty behavior.
 */
export function getDividendCreditCapRate(args: { country: string }): number {
  const code = args.country.toUpperCase();
  const treaty = TREATY_DIVIDEND_RATE_MAP.get(code);
  if (treaty === undefined) return TAX_RATE;
  return Math.min(treaty, TAX_RATE);
}
