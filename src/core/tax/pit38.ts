import {
  type CreditInterestResult,
  type DividendResult,
  type Pit38Fields,
  type PriorYearLoss,
  type TaxSummary,
  type TradeResult,
} from '../types.js';
import {
  capitalGainsTax,
  paymentSummaryAmount,
  roundedCapitalGainsBase,
  roundedCapitalGainsTaxDue,
  roundedDividendCredit,
  roundedDividendDifference,
  roundedDividendTax,
  sumCost,
  sumCreditInterestForeignTax,
  sumCreditInterestIncome,
  sumDeductibleWithholding,
  sumDividendIncome,
  sumProceeds,
} from './aggregates.js';
import {
  applyLossCarryForward,
  type ApplyLossCarryForwardResult,
} from './loss-carry-forward.js';
import { roundToGrosz } from './rounding.js';

export interface BuildPit38Args {
  trades: TradeResult[];
  dividends: DividendResult[];
  creditInterests?: CreditInterestResult[];
  summary: TaxSummary;
  /**
   * Prior-year capital losses available for carry-forward (art. 9 ust. 3
   * updof). Each entry tracks its own residual via `alreadyDeductedPln`. The
   * 5-year window and 50%-per-year cap are enforced by
   * `applyLossCarryForward`.
   */
  priorLosses?: PriorYearLoss[];
  /**
   * Precomputed loss deduction (from `computeLossDeduction`). When given, it is
   * used for poz. 30 as-is so callers share a single source of truth; otherwise
   * it is computed from `priorLosses`.
   */
  lossDeduction?: ApplyLossCarryForwardResult;
}

type SectionCFields = Pick<
  Pit38Fields,
  20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29
>;

/** Section C (poz. 20-29) — capital gains/losses, grosz-rounded. */
export function computeSectionC(args: {
  trades: TradeResult[];
}): SectionCFields {
  const f20 = 0; // No PIT-8C for foreign broker
  const f21 = 0;
  const f22 = roundToGrosz({ amount: sumProceeds({ rows: args.trades }) }); // Other proceeds
  const f23 = roundToGrosz({ amount: sumCost({ rows: args.trades }) }); // Other costs
  const f24 = 0; // No exemptions
  const f25 = 0;
  const f26 = roundToGrosz({ amount: f20 + f22 - f24 }); // Total proceeds
  const f27 = roundToGrosz({ amount: f21 + f23 - f25 }); // Total costs
  return {
    20: f20,
    21: f21,
    22: f22,
    23: f23,
    24: f24,
    25: f25,
    26: f26,
    27: f27,
    28: roundToGrosz({ amount: Math.max(f26 - f27, 0) }), // Gain
    29: roundToGrosz({ amount: Math.max(f27 - f26, 0) }), // Loss
  };
}

/**
 * Prior-year loss deduction (poz. 30) computed from the declared, grosz-
 * rounded gain in poz. 28. The single production entry point for
 * `applyLossCarryForward`, so the form and the per-year breakdown agree.
 */
export function computeLossDeduction(args: {
  trades: TradeResult[];
  priorLosses: PriorYearLoss[];
  year: number;
}): ApplyLossCarryForwardResult {
  return applyLossCarryForward({
    gainPln: computeSectionC({ trades: args.trades })[28],
    priorLosses: args.priorLosses,
    currentYear: args.year,
  });
}

/** Map TaxSummary to PIT-38(18) form field values. Key = position on form. */
export function buildPit38(args: BuildPit38Args): Pit38Fields {
  const {
    trades,
    dividends,
    creditInterests = [],
    summary,
    priorLosses,
  } = args;
  // Every Pit38Position is assigned below before `f` is returned.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const f = {} as Pit38Fields;

  const totalDividendsPln = sumDividendIncome({ rows: dividends });
  const totalCreditInterestPln = sumCreditInterestIncome({
    rows: creditInterests,
  });
  const totalDeductibleWithholdingPln = sumDeductibleWithholding({
    rows: dividends,
  });
  const totalCreditInterestForeignTaxPln = sumCreditInterestForeignTax({
    rows: creditInterests,
  });

  // Section C — Capital gains/losses
  Object.assign(f, computeSectionC({ trades }));

  // Section D — Tax calculation
  // Apply art. 9 ust. 3 updof: per-loss-year 50% cap + 5-year window.
  const lossDeduction =
    args.lossDeduction ??
    computeLossDeduction({
      trades,
      priorLosses: priorLosses ?? [],
      year: summary.year,
    });
  f[30] = lossDeduction.deductedPln;
  f[31] = roundedCapitalGainsBase({
    gainPostLcfPln: Math.max(f[28] - f[30], 0),
  });
  f[33] = capitalGainsTax({ base: f[31] });
  f[34] = 0; // No foreign tax on capital gains
  f[35] = roundedCapitalGainsTaxDue({ tax: f[33], foreignCredit: f[34] });

  // Section E — Crypto (placeholders)
  f[36] = f[37] = f[38] = f[39] = f[40] = 0;

  // Section F — Crypto tax (placeholders)
  f[41] = f[43] = f[44] = f[45] = 0;

  // Section G — Payment summary
  f[46] = 0; // No flat-rate tax
  f[47] = roundedDividendTax({
    totalIncomePln: totalDividendsPln + totalCreditInterestPln,
  });
  f[48] = roundedDividendCredit({
    deductiblePln:
      totalDeductibleWithholdingPln + totalCreditInterestForeignTaxPln,
    dividendTax: f[47],
  });
  f[49] = roundedDividendDifference({ dividendTax: f[47], credit: f[48] });
  f[50] = 0; // No advance payments
  const totalTax = f[35] + f[45] + f[46] + f[49];
  f[51] = paymentSummaryAmount({ amountPln: totalTax - f[50] });
  f[52] = paymentSummaryAmount({ amountPln: f[50] - totalTax });

  // Section H — Monthly tax (placeholders)
  f[53] = f[54] = f[55] = f[56] = f[57] = f[58] = 0;
  f[59] = f[60] = f[61] = f[62] = f[63] = f[64] = 0;

  // Section I (placeholder)
  f[65] = 0;

  return f;
}
