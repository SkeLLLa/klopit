/**
 * Table classification for the schema upgrade policy (see the comment above the
 * versions in `db.ts` and CONTRIBUTING.md, "Database Schema Upgrades").
 *
 * Lives in its own module so tests can import it without opening a database.
 */

/** User input: an upgrade must never clear or drop these tables. */
export const INPUT_TABLES = [
  'sessions',
  'trades',
  'dividends',
  'withholdingTaxes',
  'carryInPositions',
  'transactionFees',
  'creditInterests',
  'corporateActions',
  'priorLosses',
  'symbolCountryOverrides',
] as const;

/** Derived data: an upgrade may invalidate these (and must mark sessions stale). */
export const DERIVED_TABLES = [
  'tradeResults',
  'dividendResults',
  'creditInterestResults',
  'taxSummaries',
  'nbpRates',
] as const;
