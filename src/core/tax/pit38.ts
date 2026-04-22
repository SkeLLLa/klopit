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
  roundedCapitalGainsBase,
  roundedCapitalGainsTaxDue,
  roundedDividendCredit,
  roundedDividendDifference,
  roundedDividendTax,
  roundedTotalTaxToPay,
  sumCost,
  sumCreditInterestForeignTax,
  sumCreditInterestIncome,
  sumDeductibleWithholding,
  sumDividendIncome,
  sumProceeds,
} from './aggregates.js';
import { applyLossCarryForward } from './loss-carry-forward.js';

export interface BuildPit38Args {
  trades: TradeResult[];
  dividends: DividendResult[];
  creditInterests?: CreditInterestResult[];
  summary: TaxSummary;
  /**
   * Prior-year capital losses available for carry-forward (art. 9 ust. 3
   * updof). Each entry tracks its own residual via `alreadyDeductedPln`.
   * The 5-year window and 50%-per-year cap are enforced by
   * `applyLossCarryForward`.
   */
  priorLosses?: PriorYearLoss[];
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
  const f = {} as Pit38Fields;

  const totalProceedsPln = sumProceeds({ rows: trades });
  const totalCostPln = sumCost({ rows: trades });
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
  f[20] = 0; // No PIT-8C for foreign broker
  f[21] = 0;
  f[22] = totalProceedsPln; // Other proceeds
  f[23] = totalCostPln; // Other costs
  f[24] = 0; // No exemptions
  f[25] = 0;
  f[26] = f[20] + f[22] - f[24]; // Total proceeds
  f[27] = f[21] + f[23] - f[25]; // Total costs
  f[28] = Math.max(f[26] - f[27], 0); // Gain
  f[29] = Math.max(f[27] - f[26], 0); // Loss

  // Section D — Tax calculation
  // Apply art. 9 ust. 3 updof: per-loss-year 50% cap + 5-year window.
  const lossDeduction = applyLossCarryForward({
    gainPln: f[28],
    priorLosses: priorLosses ?? [],
    currentYear: summary.year,
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
  f[51] = roundedTotalTaxToPay({ totalRawPln: totalTax - f[50] });
  f[52] = roundedTotalTaxToPay({ totalRawPln: f[50] - totalTax });

  // Section H — Monthly tax (placeholders)
  f[53] = f[54] = f[55] = f[56] = f[57] = f[58] = 0;
  f[59] = f[60] = f[61] = f[62] = f[63] = f[64] = 0;

  // Section I (placeholder)
  f[65] = 0;

  return f;
}
