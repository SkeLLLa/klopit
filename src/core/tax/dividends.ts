import type {
  DividendResult,
  DividendWarning,
  EnrichedRawDividend,
  EnrichedWithholdingTax,
  TaxPeriod,
} from '../types.js';
import { getDividendCreditCapRate } from './treaty-rates.js';

export interface CalculateDividendsArgs {
  dividends: EnrichedRawDividend[];
  withholdingTaxes: EnrichedWithholdingTax[];
  taxPeriod: TaxPeriod;
  symbolCountryMap?: Map<string, string>;
}

function toDateString(args: { date: Date }): string {
  const year = args.date.getFullYear();
  const month = String(args.date.getMonth() + 1).padStart(2, '0');
  const day = String(args.date.getDate()).padStart(2, '0');
  return `${String(year)}-${month}-${day}`;
}

function matchKey(args: { isin?: string; symbol: string; date: Date }): string {
  const id = (args.isin ?? args.symbol).toUpperCase();
  return `${toDateString({ date: args.date })}:${id}`;
}

/** Match dividends with withholding taxes and convert to PLN */
export function calculateDividends(
  args: CalculateDividendsArgs,
): DividendResult[] {
  const { dividends, withholdingTaxes, taxPeriod } = args;
  const symbolCountryMap = args.symbolCountryMap ?? new Map<string, string>();

  // Group withholding taxes by match key
  const taxMap = new Map<string, EnrichedWithholdingTax[]>();
  for (const tax of withholdingTaxes) {
    const key = matchKey(tax);
    let group = taxMap.get(key);
    if (!group) {
      group = [];
      taxMap.set(key, group);
    }
    group.push(tax);
  }

  const results: DividendResult[] = [];

  for (const div of dividends) {
    // Filter by tax period
    if (div.date < taxPeriod.from || div.date > taxPeriod.to) {
      continue;
    }

    const key = matchKey(div);
    const matchedTaxes = taxMap.get(key) ?? [];

    // Sum withholding amounts (IB stores as negative — use Math.abs)
    const withholdingTaxOriginal = matchedTaxes.reduce(
      (sum, tax) => sum + Math.abs(tax.amount),
      0,
    );

    // Convert dividend to PLN
    const amountPln = div.amount * div.exchangeRate;

    // Convert withholding to PLN (each entry may have its own rate)
    const withholdingTaxPln = matchedTaxes.reduce(
      (sum, tax) => sum + Math.abs(tax.amount) * tax.exchangeRate,
      0,
    );

    const rateUnavailable =
      div.rateUnavailable || matchedTaxes.some((tax) => tax.rateUnavailable);

    const country = symbolCountryMap.get(div.symbol) ?? 'XX';
    const warnings: DividendWarning[] = [];

    if (country === 'XX') {
      warnings.push({ kind: 'unknown-country' });
    }

    // Check for W-8BEN lapse: withheld rate exceeds treaty rate
    if (div.amount > 0 && withholdingTaxOriginal > 0) {
      const withheldRate = withholdingTaxOriginal / div.amount;
      const treatyRate = getDividendCreditCapRate({ country });
      const tolerance = 0.005; // ±0.5% tolerance for rounding

      if (withheldRate > treatyRate + tolerance) {
        warnings.push({
          kind: 'wht-lapse',
        });
      }
    }

    results.push({
      symbol: div.symbol,
      currency: div.currency,
      date: div.date,
      amountOriginal: div.amount,
      withholdingTaxOriginal,
      amountPln,
      withholdingTaxPln,
      exchangeRate: div.exchangeRate,
      rateUnavailable,
      country,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  }

  return results;
}
