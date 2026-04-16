import {
  TAX_RATE,
  type CreditInterestResult,
  type EnrichedCreditInterest,
  type TaxPeriod,
} from '../types.js';

/**
 * Convert credit-interest rows into tax results for PIT-38 Section G.
 *
 * Foreign withholding is currently assumed to be zero for the supported
 * IBKR flow; the dedicated fields stay in the result shape for future
 * broker/entity-specific withholding support.
 */
export function calculateCreditInterest(args: {
  creditInterests: (EnrichedCreditInterest & { fxDate?: string })[];
  taxPeriod: TaxPeriod;
}): CreditInterestResult[] {
  const results: CreditInterestResult[] = [];

  for (const row of args.creditInterests) {
    if (row.date < args.taxPeriod.from || row.date > args.taxPeriod.to) {
      continue;
    }

    const amountPln = row.amount * row.exchangeRate;

    results.push({
      currency: row.currency,
      date: row.date,
      description: row.description,
      amountOriginal: row.amount,
      amountPln,
      exchangeRate: row.exchangeRate,
      fxDate: row.fxDate ?? '',
      rateUnavailable: row.rateUnavailable,
      taxPlnGross: amountPln * TAX_RATE,
      foreignTaxOriginal: 0,
      foreignTaxPln: 0,
      foreignTaxExchangeRate: 0,
    });
  }

  return results;
}
