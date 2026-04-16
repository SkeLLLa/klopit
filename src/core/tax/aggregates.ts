import {
  TAX_RATE,
  type CreditInterestResult,
  type DividendResult,
  type TradeResult,
} from '../types.js';
import { roundToFullPln, roundToGroszUp } from './rounding.js';

// ---------------------------------------------------------------------------
// Per-collection raw sums
// ---------------------------------------------------------------------------

/** Sum gross dividend income (PLN). */
export function sumDividendIncome(args: { rows: DividendResult[] }): number {
  return args.rows.reduce((s, d) => s + d.amountPln, 0);
}

/** Sum total withholding tax paid abroad (PLN). */
export function sumWithholding(args: { rows: DividendResult[] }): number {
  return args.rows.reduce((s, d) => s + d.withholdingTaxPln, 0);
}

/** Sum treaty-capped deductible withholding (PLN). */
export function sumDeductibleWithholding(args: {
  rows: DividendResult[];
}): number {
  return args.rows.reduce((s, d) => s + d.deductibleWithholdingPln, 0);
}

/** Sum gross dividend tax (PLN). */
export function sumDividendTaxGross(args: { rows: DividendResult[] }): number {
  return args.rows.reduce((s, d) => s + d.taxPlnGross, 0);
}

/** Sum gross credit-interest income (PLN). */
export function sumCreditInterestIncome(args: {
  rows: CreditInterestResult[];
}): number {
  return args.rows.reduce((s, row) => s + row.amountPln, 0);
}

/** Sum foreign tax paid on credit interest (PLN). */
export function sumCreditInterestForeignTax(args: {
  rows: CreditInterestResult[];
}): number {
  return args.rows.reduce((s, row) => s + row.foreignTaxPln, 0);
}

/** Sum net dividend tax to pay after withholding credit (PLN). */
export function sumDividendTaxToPay(args: { rows: DividendResult[] }): number {
  return args.rows.reduce((s, d) => s + d.taxToPayPln, 0);
}

/** Sum sell proceeds (PLN). Includes all sell-type rows. */
export function sumProceeds(args: { rows: TradeResult[] }): number {
  return args.rows
    .filter((t) => t.type === 'sell')
    .reduce((s, t) => s + t.proceedsPln, 0);
}

/** Sum FIFO cost basis of sells (PLN). */
export function sumCost(args: { rows: TradeResult[] }): number {
  return args.rows
    .filter((t) => t.type === 'sell')
    .reduce((s, t) => s + t.costPln, 0);
}

/** Sum gain/loss across sells (PLN). */
export function sumGainLoss(args: { rows: TradeResult[] }): number {
  return args.rows
    .filter((t) => t.type === 'sell')
    .reduce((s, t) => s + t.gainLossPln, 0);
}

/** Sum per-row pre-LCF tax across sells (PLN). */
export function sumTradeTaxPreLcf(args: { rows: TradeResult[] }): number {
  return args.rows
    .filter((t) => t.type === 'sell')
    .reduce((s, t) => s + t.taxPln, 0);
}

// ---------------------------------------------------------------------------
// Slicing
// ---------------------------------------------------------------------------

/** Group rows by country code. */
export function groupByCountry<T extends { country: string }>(args: {
  rows: T[];
}): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of args.rows) {
    let group = map.get(row.country);
    if (!group) {
      group = [];
      map.set(row.country, group);
    }
    group.push(row);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Form-rule aggregations (raw -> rounded)
// ---------------------------------------------------------------------------

/** Round dividend tax (19% of gross income), grosze-up. PIT-38(18) poz 47. */
export function roundedDividendTax(args: { totalIncomePln: number }): number {
  return roundToGroszUp({ amount: args.totalIncomePln * TAX_RATE });
}

/** Capped foreign withholding credit (\<=rounded dividend tax). PIT-38(18) poz 48. */
export function roundedDividendCredit(args: {
  deductiblePln: number;
  dividendTax: number;
}): number {
  return Math.round(Math.min(args.deductiblePln, args.dividendTax) * 100) / 100;
}

/** Difference (tax minus credit), grosze-up. PIT-38(18) poz 49. */
export function roundedDividendDifference(args: {
  dividendTax: number;
  credit: number;
}): number {
  return roundToGroszUp({
    amount: Math.max(args.dividendTax - args.credit, 0),
  });
}

/** Capital-gains tax base (gain minus prior-year losses), full PLN. PIT-38(18) poz 31. */
export function roundedCapitalGainsBase(args: {
  gainPostLcfPln: number;
}): number {
  return roundToFullPln({ amount: Math.max(args.gainPostLcfPln, 0) });
}

/** Capital-gains tax (19% of the already-rounded base). PIT-38(18) poz 33. */
export function capitalGainsTax(args: { base: number }): number {
  return args.base * TAX_RATE;
}

/** Capital-gains tax due (after foreign credit), rounded to full PLN. PIT-38(18) poz 35. */
export function roundedCapitalGainsTaxDue(args: {
  tax: number;
  foreignCredit: number;
}): number {
  return roundToFullPln({
    amount: Math.max(args.tax - args.foreignCredit, 0),
  });
}

/** Total tax to pay, rounded to full PLN. PIT-38(18) poz 51. */
export function roundedTotalTaxToPay(args: { totalRawPln: number }): number {
  return roundToFullPln({ amount: Math.max(args.totalRawPln, 0) });
}
