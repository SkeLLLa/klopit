import {
  TAX_RATE,
  type DividendResult,
  type DividendWarning,
  type EnrichedRawDividend,
  type EnrichedWithholdingTax,
  type PaymentKind,
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
  /** ADR symbols whose rows disagree on the issuer country (no user override). */
  adrCountryConflicts?: ReadonlySet<string>;
  /**
   * Symbol → country by ISIN prefix (no ADR issuer country). Fallback for a
   * payment-in-lieu event that has no withholding row to name its country.
   */
  isinCountryMap?: Map<string, string>;
}

function toDateString(args: { date: Date }): string {
  const year = args.date.getFullYear();
  const month = String(args.date.getMonth() + 1).padStart(2, '0');
  const day = String(args.date.getDate()).padStart(2, '0');
  return `${String(year)}-${month}-${day}`;
}

function matchKey(args: {
  isin?: string;
  symbol: string;
  currency: string;
  date: Date;
  kind?: PaymentKind;
}): string {
  const id = (args.isin ?? args.symbol).toUpperCase();
  // An ordinary dividend and a payment in lieu on the same day are separate events.
  return `${toDateString({ date: args.date })}:${id}:${args.currency.toUpperCase()}:${args.kind ?? 'dividend'}`;
}

function feeMatchKey(args: {
  isin?: string;
  symbol: string;
  currency: string;
  datetime: Date;
}): string {
  return matchKey({
    isin: args.isin,
    symbol: args.symbol,
    currency: args.currency,
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

  // Group dividend rows by event key so reversals and re-postings net out
  // and matched WHT / ADR fees are attributed once per event.
  const divGroups = new Map<string, EnrichedRawDividend[]>();
  for (const div of dividends) {
    if (!isInTaxPeriod({ date: div.date, taxPeriod })) continue;
    const key = matchKey(div);
    let group = divGroups.get(key);
    if (!group) {
      group = [];
      divGroups.set(key, group);
    }
    group.push(div);
  }

  const results: DividendResult[] = [];

  for (const [key, divRows] of divGroups) {
    const div = divRows[0];
    const matchedTaxes = taxMap.get(key) ?? [];
    const matchedAdrFees = adrFeeMap.get(key) ?? [];

    const grossOriginal = divRows.reduce((sum, row) => sum + row.amount, 0);
    const grossPln = divRows.reduce(
      (sum, row) => sum + row.amount * row.exchangeRate,
      0,
    );
    const ratesAgree = divRows.every(
      (row) => row.exchangeRate === div.exchangeRate,
    );
    const exchangeRate = ratesAgree
      ? div.exchangeRate
      : (divRows.find((row) => row.amount > 0) ?? div).exchangeRate;

    const adrFeeOriginal = matchedAdrFees.reduce(
      (sum, fee) => sum + fee.amount,
      0,
    );
    const taxableAmountOriginal = Math.max(grossOriginal - adrFeeOriginal, 0);

    // Convert dividend to PLN
    const amountPln = ratesAgree
      ? taxableAmountOriginal * exchangeRate
      : Math.max(grossPln - adrFeeOriginal * exchangeRate, 0);
    const adrFeePln = adrFeeOriginal * exchangeRate;

    // Withholding sign convention: negative = tax withheld, positive =
    // refund/reversal. Net per event, floored at 0 (art. 30a ust. 9 updof
    // credits only tax actually paid). Each entry may have its own rate.
    const netWithholdingOriginal = matchedTaxes.reduce(
      (sum, tax) => sum + tax.amount,
      0,
    );
    const withholdingTaxOriginal = Math.max(-netWithholdingOriginal, 0);
    const withholdingTaxPln = Math.max(
      -matchedTaxes.reduce(
        (sum, tax) => sum + tax.amount * tax.exchangeRate,
        0,
      ),
      0,
    );

    const rateUnavailable =
      divRows.some((row) => row.rateUnavailable) ||
      matchedTaxes.some((tax) => tax.rateUnavailable);

    const isPil = div.kind === 'payment-in-lieu';
    // A payment in lieu is taxed where it was withheld (e.g. US on lent ADRs),
    // regardless of the ADR issuer country.
    const country = isPil
      ? (matchedTaxes.find((tax) => tax.taxCountry)?.taxCountry ??
        args.isinCountryMap?.get(div.symbol) ??
        symbolCountryMap.get(div.symbol) ??
        'XX')
      : (symbolCountryMap.get(div.symbol) ?? 'XX');
    const warnings: DividendWarning[] = [];

    if (country === 'XX') {
      warnings.push({ kind: 'unknown-country' });
    }

    if (!isPil && args.adrCountryConflicts?.has(div.symbol)) {
      warnings.push({ kind: 'adr-country-conflict' });
    }

    if (grossOriginal < 0) {
      warnings.push({ kind: 'net-negative' });
    }

    if (netWithholdingOriginal > 0) {
      warnings.push({ kind: 'wht-net-refund' });
    }

    // W-8BEN lapse (withheld rate above treaty rate). W-8BEN is a US form, so it
    // cannot lapse for an ADR whose issuer is not US.
    const isNonUsAdr = divRows.some((row) => row.isAdr) && country !== 'US';
    if (taxableAmountOriginal > 0 && withholdingTaxOriginal > 0) {
      const withheldRate = withholdingTaxOriginal / taxableAmountOriginal;
      const treatyRate = getDividendCreditCapRate({ country });
      const tolerance = 0.005; // ±0.5% tolerance for rounding

      if (withheldRate > treatyRate + tolerance) {
        if (isPil) {
          warnings.push({ kind: 'pil-excess-not-credited' });
        } else if (!isNonUsAdr) {
          warnings.push({ kind: 'wht-lapse' });
        }
      }
    }

    if (isPil) {
      warnings.push({ kind: 'pil-substitute' });
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
      exchangeRate,
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
