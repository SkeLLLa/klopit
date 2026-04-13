import { TAX_RATE } from '../types.js';

/**
 * Maximum creditable foreign withholding tax rate on dividends, per country of
 * the dividend-paying entity (ISO 3166-1 alpha-2). Sourced from Polish
 * double-tax treaties (UPO) in force as of 2026-04. Values are decimals
 * (0.15 = 15%).
 *
 * Countries not present in this map fall back to the domestic 19% cap from
 * art. 30a ust. 9 ustawy o PIT. A missing entry over-credits at most by
 * (19% − treaty rate) × gross dividend; a wrong entry would under-credit
 * real tax.
 *
 * Rates below are the **portfolio** (default, higher) dividend rate from each
 * treaty — kloPIT targets individual investors who virtually never hold the
 * ≥10–25 % stakes required to unlock the reduced inter-company rate.
 *
 * Data source: PwC Worldwide Tax Summaries — Poland, Withholding taxes
 * (https://taxsummaries.pwc.com/poland/corporate/withholding-taxes).
 * Cross-reference the full official treaty list at:
 * https://www.podatki.gov.pl/podatkowa-wspolpraca-miedzynarodowa/wykaz-umow-o-unikaniu-podwojnego-opodatkowania/
 */
export const TREATY_DIVIDEND_RATE_MAP: ReadonlyMap<string, number> = new Map([
  ['AE', 0.05], // United Arab Emirates
  ['AL', 0.1], // Albania
  ['AM', 0.1], // Armenia
  ['AT', 0.15], // Austria
  ['AU', 0.15], // Australia
  ['AZ', 0.1], // Azerbaijan
  ['BA', 0.15], // Bosnia & Herzegovina
  ['BD', 0.15], // Bangladesh
  ['BE', 0.1], // Belgium
  ['BG', 0.1], // Bulgaria
  ['BR', 0.15], // Brazil
  ['BY', 0.15], // Belarus
  ['CA', 0.15], // Canada
  ['CH', 0.15], // Switzerland
  ['CL', 0.15], // Chile
  ['CN', 0.1], // China
  ['CY', 0.05], // Cyprus
  ['CZ', 0.05], // Czech Republic
  ['DE', 0.15], // Germany
  ['DK', 0.15], // Denmark
  ['DZ', 0.15], // Algeria
  ['EE', 0.15], // Estonia
  ['EG', 0.12], // Egypt
  ['ES', 0.15], // Spain
  ['ET', 0.1], // Ethiopia
  ['FI', 0.15], // Finland
  ['FR', 0.15], // France
  ['GB', 0.1], // United Kingdom
  ['GE', 0.05], // Georgia
  ['GR', 0.19], // Greece (treaty rate equals domestic)
  ['HR', 0.15], // Croatia
  ['HU', 0.1], // Hungary
  ['ID', 0.15], // Indonesia
  ['IE', 0.15], // Ireland
  ['IL', 0.1], // Israel
  ['IN', 0.1], // India
  ['IR', 0.07], // Iran
  ['IS', 0.15], // Iceland
  ['IT', 0.1], // Italy
  ['JO', 0.1], // Jordan
  ['JP', 0.1], // Japan
  ['KG', 0.1], // Kyrgyzstan
  ['KR', 0.1], // Korea (South)
  ['KW', 0.05], // Kuwait
  ['KZ', 0.15], // Kazakhstan
  ['LB', 0.05], // Lebanon
  ['LK', 0.1], // Sri Lanka
  ['LT', 0.15], // Lithuania
  ['LU', 0.15], // Luxembourg
  ['LV', 0.15], // Latvia
  ['MA', 0.15], // Morocco
  ['MD', 0.15], // Moldova
  ['ME', 0.15], // Montenegro
  ['MK', 0.15], // North Macedonia
  ['MN', 0.1], // Mongolia
  ['MT', 0.1], // Malta
  ['MX', 0.15], // Mexico
  ['MY', 0.05], // Malaysia
  ['NG', 0.1], // Nigeria
  ['NL', 0.15], // Netherlands
  ['NO', 0.15], // Norway
  ['NZ', 0.15], // New Zealand
  ['PH', 0.15], // Philippines
  ['PK', 0.15], // Pakistan
  ['PT', 0.15], // Portugal
  ['QA', 0.05], // Qatar
  ['RO', 0.15], // Romania
  ['RS', 0.15], // Serbia
  ['SA', 0.05], // Saudi Arabia
  ['SE', 0.15], // Sweden
  ['SG', 0.1], // Singapore
  ['SI', 0.15], // Slovenia
  ['SK', 0.05], // Slovak Republic
  ['SY', 0.1], // Syria
  ['TH', 0.19], // Thailand (DTT rate is 20 %; stored at domestic 19 % cap)
  ['TJ', 0.15], // Tajikistan
  ['TN', 0.1], // Tunisia
  ['TR', 0.15], // Turkey
  ['TW', 0.1], // Taiwan
  ['UA', 0.15], // Ukraine
  ['US', 0.15], // United States
  ['UY', 0.15], // Uruguay
  ['UZ', 0.15], // Uzbekistan
  ['VN', 0.15], // Vietnam
  ['ZA', 0.15], // South Africa
  ['ZM', 0.15], // Zambia
  ['ZW', 0.15], // Zimbabwe
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
