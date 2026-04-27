import {
  TAX_RATE,
  type DividendResult,
  type DividendWarning,
  type EnrichedRawDividend,
  type EnrichedWithholdingTax,
  type TaxPeriod,
  type TransactionFee,
} from '../types.js';
import { isInTaxPeriod } from './period.js';
import { getDividendCreditCapRate } from './treaty-rates.js';

export interface CalculateDividendsArgs {
  dividends: EnrichedRawDividend[];
  withholdingTaxes: EnrichedWithholdingTax[];
  transactionFees?: TransactionFee[];
  reduceAdrFeesFromDividends?: boolean;
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

function feeMatchKey(args: {
  isin?: string;
  symbol: string;
  datetime: Date;
}): string {
  return matchKey({
    isin: args.isin,
    symbol: args.symbol,
    date: args.datetime,
  });
}

function isAdrFee(fee: TransactionFee): boolean {
  const normalized = fee.description.toUpperCase().replace(/[-_/]+/g, ' ');
  return (
    normalized.includes('ADR') ||
    normalized.includes('GDR') ||
    normalized.includes('CDI')
  );
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
    if (!isInTaxPeriod({ date: tax.date, taxPeriod })) continue;
    const key = matchKey(tax);
    let group = taxMap.get(key);
    if (!group) {
      group = [];
      taxMap.set(key, group);
    }
    group.push(tax);
  }

  const adrFeeMap = new Map<string, TransactionFee[]>();
  if (args.reduceAdrFeesFromDividends) {
    for (const fee of args.transactionFees ?? []) {
      if (!isAdrFee(fee) || !isInTaxPeriod({ date: fee.datetime, taxPeriod })) {
        continue;
      }
      const key = feeMatchKey(fee);
      let group = adrFeeMap.get(key);
      if (!group) {
        group = [];
        adrFeeMap.set(key, group);
      }
      group.push(fee);
    }
  }

  const results: DividendResult[] = [];

  for (const div of dividends) {
    // Filter by tax period
    if (!isInTaxPeriod({ date: div.date, taxPeriod })) {
      continue;
    }

    const key = matchKey(div);
    const matchedTaxes = taxMap.get(key) ?? [];
    const matchedAdrFees = (adrFeeMap.get(key) ?? []).filter(
      (fee) => fee.currency === div.currency,
    );
    const adrFeeOriginal = matchedAdrFees.reduce(
      (sum, fee) => sum + fee.amount,
      0,
    );
    const taxableAmountOriginal = Math.max(div.amount - adrFeeOriginal, 0);

    // Sum withholding amounts (IB stores as negative — use Math.abs)
    const withholdingTaxOriginal = matchedTaxes.reduce(
      (sum, tax) => sum + Math.abs(tax.amount),
      0,
    );

    // Convert dividend to PLN
    const amountPln = taxableAmountOriginal * div.exchangeRate;
    const adrFeePln = adrFeeOriginal * div.exchangeRate;

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
    if (taxableAmountOriginal > 0 && withholdingTaxOriginal > 0) {
      const withheldRate = withholdingTaxOriginal / taxableAmountOriginal;
      const treatyRate = getDividendCreditCapRate({ country });
      const tolerance = 0.005; // ±0.5% tolerance for rounding

      if (withheldRate > treatyRate + tolerance) {
        warnings.push({
          kind: 'wht-lapse',
        });
      }
    }

    const creditCapRate = getDividendCreditCapRate({ country });
    const deductibleWithholdingPln = Math.min(
      withholdingTaxPln,
      amountPln * creditCapRate,
    );
    const taxPlnGross = amountPln * TAX_RATE;
    const taxToPayPln = Math.max(taxPlnGross - deductibleWithholdingPln, 0);

    results.push({
      symbol: div.symbol,
      currency: div.currency,
      date: div.date,
      amountOriginal: taxableAmountOriginal,
      withholdingTaxOriginal,
      adrFeeOriginal,
      adrFeePln,
      amountPln,
      withholdingTaxPln,
      exchangeRate: div.exchangeRate,
      rateUnavailable,
      country,
      creditCapRate,
      deductibleWithholdingPln,
      taxPlnGross,
      taxToPayPln,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  }

  return results;
}
