import { TAX_RATE, type Pit38Fields, type TaxSummary } from '../types.js';
import { roundToFullPln, roundToGroszUp } from './rounding.js';

export interface BuildPit38Args {
  summary: TaxSummary;
  priorYearLoss?: number;
}

/** Map TaxSummary to PIT-38(18) form field values. Key = position on form. */
export function buildPit38(args: BuildPit38Args): Pit38Fields {
  const { summary, priorYearLoss } = args;
  const f = {} as Pit38Fields;

  // Section C — Capital gains/losses
  f[20] = 0; // No PIT-8C for foreign broker
  f[21] = 0;
  f[22] = summary.totalProceedsPln; // Other proceeds
  f[24] = 0; // No exemptions
  f[25] = 0;
  f[26] = f[20] + f[22] - f[24]; // Total proceeds
  f[27] = f[21] + summary.totalCostPln - f[25]; // Total costs
  f[28] = Math.max(f[26] - f[27], 0); // Gain
  f[29] = Math.max(f[27] - f[26], 0); // Loss

  // Section D — Tax calculation
  f[30] = Math.min(priorYearLoss ?? 0, f[28]); // Deductible prior year loss
  f[31] = roundToFullPln({ amount: Math.max(f[28] - f[30], 0) });
  f[33] = f[31] * TAX_RATE;
  f[34] = 0; // No foreign tax on capital gains
  f[35] = roundToFullPln({ amount: Math.max(f[33] - f[34], 0) });

  // Section E — Crypto (placeholders)
  f[36] = f[37] = f[38] = f[39] = f[40] = 0;

  // Section F — Crypto tax (placeholders)
  f[41] = f[43] = f[44] = f[45] = 0;

  // Section G — Payment summary
  f[46] = 0; // No flat-rate tax
  f[47] = roundToGroszUp({ amount: summary.totalDividendsPln * TAX_RATE });
  f[48] =
    Math.round(Math.min(summary.totalDeductibleWithholdingPln, f[47]) * 100) /
    100;
  f[49] = roundToGroszUp({ amount: Math.max(f[47] - f[48], 0) });
  f[50] = 0; // No advance payments
  const totalTax = f[35] + f[45] + f[46] + f[49];
  f[51] = roundToFullPln({ amount: Math.max(totalTax - f[50], 0) });
  f[52] = roundToFullPln({ amount: Math.max(f[50] - totalTax, 0) });

  // Section H — Monthly tax (placeholders)
  f[53] = f[54] = f[55] = f[56] = f[57] = f[58] = 0;
  f[59] = f[60] = f[61] = f[62] = f[63] = f[64] = 0;

  // Section I (placeholder)
  f[65] = 0;

  return f;
}
