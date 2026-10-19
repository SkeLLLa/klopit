import {
  TAX_RATE,
  type CreditInterestResult,
  type DividendResult,
  type TradeResult,
} from '../types.js';
import { roundToFullPln, roundToGrosz, roundToGroszUp } from './rounding.js';

// ---------------------------------------------------------------------------
// Per-collection raw sums
// ---------------------------------------------------------------------------

/** Sum gross dividend income (PLN). */
export function sumDividendIncome(args: { rows: DividendResult[] }): number {
  return args.rows.reduce((s, d) => s + d.amountPln, 0);
}

/** Sum total withholding tax paid abroad (PLN). */
export function sumWithholding(args: { rows: DividendResult[] }): number {
  return args.rows.reduce(
    (s, d) => (d.isInfo ? s : s + d.withholdingTaxPln),
    0,
  );
}

/** Sum treaty-capped deductible withholding (PLN). */
export function sumDeductibleWithholding(args: {
  rows: DividendResult[];
}): number {
  return args.rows.reduce((s, d) => s + d.deductibleWithholdingPln, 0);
}

/** Sum credit added back by later-year WHT refunds (art. 45 ust. 3a, PLN). */
export function sumDividendAddBack(args: { rows: DividendResult[] }): number {
  return args.rows.reduce((s, d) => s + (d.addBackPln ?? 0), 0);
}

/** Sum gross dividend tax (PLN). */
export function sumDividendTaxGross(args: { rows: DividendResult[] }): number {
  return args.rows.reduce((s, d) => s + d.taxPlnGross, 0);
}

/**
 * Dividend income split for the dashboard charts. `net + withholding + taxOwed`
 * equals `income`; `addBack` (art. 45 ust. 3a) is tax on money received in an
 * earlier year, so it stays a separate part on top of the income.
 */
export function dividendBreakdown(args: { rows: DividendResult[] }): {
  income: number;
  net: number;
  withholding: number;
  taxOwed: number;
  addBack: number;
} {
  const income = Math.max(sumDividendIncome(args), 0);
  const addBack = sumDividendAddBack(args);
  return {
    income,
    net: income - income * TAX_RATE,
    withholding: sumDeductibleWithholding(args),
    taxOwed: Math.max(sumDividendTaxToPay(args) - addBack, 0),
    addBack,
  };
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

/**
 * Sum net dividend tax to pay after withholding credit (PLN), including the
 * art. 45 ust. 3a add-back of refunded earlier-year credit.
 */
export function sumDividendTaxToPay(args: { rows: DividendResult[] }): number {
  return args.rows.reduce((s, d) => s + d.taxToPayPln + (d.addBackPln ?? 0), 0);
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

/** Per-part and total amounts for PIT-38(18) section G poz. 47-49. */
export interface SectionGForeignFlatTax {
  /** Poz. 47: dividend tax plus interest tax. */
  poz47: number;
  /** Poz. 48: foreign tax credit (each part capped at its own tax). */
  poz48: number;
  /** Poz. 49: tax due, each part rounded under its own rule. */
  poz49: number;
  dividend: { tax: number; credit: number; due: number };
  interest: { tax: number; credit: number; due: number };
}

/**
 * Section G (poz. 47-49) computed per component.
 *
 * - Dividends (art. 30a ust. 1 pkt 4): tax due is rounded to full PLN under art.
 *   63 § 1 OP (below 50 gr dropped, 50 gr and over rounded up).
 * - Interest (art. 30a ust. 1 pkt 3): base and tax are rounded up to the grosz
 *   under art. 63 § 1a OP, which covers only pkt 1-3.
 * - Each foreign-tax credit is capped at its own part (art. 30a ust. 9).
 * - A WHT refund of an earlier year's credit is added back (art. 45 ust. 3a). MF
 *   gives no field for it, so it reduces poz. 48 and any remainder raises the
 *   dividend part of poz. 47; poz. 49 is the same either way.
 */
export function sectionGForeignFlatTax(args: {
  dividendIncomePln: number;
  dividendDeductiblePln: number;
  /**
   * Credit added back by WHT refunds received this year (art. 45 ust. 3a
   * updof). Reduces the credit first; any remainder is added to the dividend
   * tax.
   */
  dividendAddBackPln?: number | undefined;
  interestIncomePln: number;
  interestForeignTaxPln: number;
}): SectionGForeignFlatTax {
  const dividendIncome = Math.max(args.dividendIncomePln, 0);
  const dividendDeductible = Math.max(args.dividendDeductiblePln, 0);
  const interestIncome = Math.max(args.interestIncomePln, 0);
  const interestForeignTax = Math.max(args.interestForeignTaxPln, 0);

  // Double rounding is intentional and follows the form layout: poz. 47 and 48
  // are zł,gr amounts, while poz. 49 is "po zaokrągleniu do pełnych złotych"
  // of poz. 47 − poz. 48. So the grosz-rounded tax and credit are subtracted
  // first, and only then is the difference rounded to full PLN.
  const addBack = Math.max(args.dividendAddBackPln ?? 0, 0);
  const baseDivTax = roundToGrosz({ amount: dividendIncome * TAX_RATE });
  const baseCredit = roundToGrosz({
    amount: Math.min(dividendDeductible, baseDivTax),
  });
  const divCredit = roundToGrosz({ amount: Math.max(baseCredit - addBack, 0) });
  const divTax = roundToGrosz({
    amount: baseDivTax + Math.max(addBack - baseCredit, 0),
  });
  const divDue = roundToFullPln({
    amount: roundToGrosz({ amount: Math.max(divTax - divCredit, 0) }),
  });

  const intBase = roundToGroszUp({ amount: interestIncome });
  const intTax = roundToGroszUp({ amount: intBase * TAX_RATE });
  const intCredit = roundToGrosz({
    amount: Math.min(interestForeignTax, intTax),
  });
  const intDue = roundToGroszUp({
    amount: Math.max(intTax - intCredit, 0),
  });

  return {
    poz47: roundToGrosz({ amount: divTax + intTax }),
    poz48: roundToGrosz({ amount: divCredit + intCredit }),
    poz49: roundToGrosz({ amount: divDue + intDue }),
    dividend: { tax: divTax, credit: divCredit, due: divDue },
    interest: { tax: intTax, credit: intCredit, due: intDue },
  };
}

/** Payment summary amount, kept in grosze. PIT-38(18) poz 51/52. */
export function paymentSummaryAmount(args: { amountPln: number }): number {
  return Math.round((Math.max(args.amountPln, 0) + Number.EPSILON) * 100) / 100;
}

/**
 * Capital-gains tax base (gain minus prior-year losses), full PLN. PIT-38(18)
 * poz 31.
 */
export function roundedCapitalGainsBase(args: {
  gainPostLcfPln: number;
}): number {
  return roundToFullPln({ amount: Math.max(args.gainPostLcfPln, 0) });
}

/**
 * Capital-gains tax (19% of the already-rounded base), to the grosz. PIT-38(18)
 * poz 33.
 */
export function capitalGainsTax(args: { base: number }): number {
  return roundToGrosz({ amount: args.base * TAX_RATE });
}

/**
 * Capital-gains tax due (after foreign credit), rounded to full PLN. PIT-38(18)
 * poz 35.
 */
export function roundedCapitalGainsTaxDue(args: {
  tax: number;
  foreignCredit: number;
}): number {
  return roundToFullPln({
    amount: Math.max(args.tax - args.foreignCredit, 0),
  });
}
