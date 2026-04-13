import {
  TAX_RATE,
  type CarryInPosition,
  type DividendResult,
  type EnrichedCorporateAction,
  type EnrichedRawDividend,
  type EnrichedTrade,
  type EnrichedWithholdingTax,
  type Pit38Fields,
  type PitZgFields,
  type PriorYearLoss,
  type TaxPeriod,
  type TaxSummary,
  type TradeResult,
} from '../types.js';
import { calculateCapitalGains } from './capital-gains.js';
import { calculateDividends } from './dividends.js';
import {
  applyLossCarryForward,
  type ApplyLossCarryForwardResult,
} from './loss-carry-forward.js';
import { buildPitZg } from './pit-zg.js';
import { buildPit38 } from './pit38.js';
import { getDividendCreditCapRate } from './treaty-rates.js';

export interface CalculateTaxesArgs {
  trades: EnrichedTrade[];
  dividends: EnrichedRawDividend[];
  withholdingTaxes: EnrichedWithholdingTax[];
  corporateActions: EnrichedCorporateAction[];
  carryInPositions: CarryInPosition[];
  /**
   * Prior-year capital losses (art. 9 ust. 3 updof). Replaces the legacy
   * single-number `priorYearLoss` field — each year carries its own
   * residual and 50%-per-year cap.
   */
  priorLosses?: PriorYearLoss[];
  taxPeriod: TaxPeriod;
  symbolCountryMap?: Map<string, string>;
}

export interface TaxCalculationResult {
  trades: TradeResult[];
  dividends: DividendResult[];
  summary: TaxSummary;
  pit38: Pit38Fields;
  pitZg: PitZgFields[];
  /** Per-year breakdown of how prior-year losses were applied. */
  lossDeduction: ApplyLossCarryForwardResult;
}

/** Orchestrate full tax calculation pipeline */
export function calculateTaxes(args: CalculateTaxesArgs): TaxCalculationResult {
  const {
    trades,
    dividends,
    withholdingTaxes,
    corporateActions,
    carryInPositions,
    priorLosses,
    taxPeriod,
  } = args;

  const countryMap = args.symbolCountryMap ?? new Map<string, string>();

  const tradeResults = calculateCapitalGains({
    trades,
    corporateActions,
    carryInPositions,
    taxPeriod,
    symbolCountryMap: countryMap,
  });

  const dividendResults = calculateDividends({
    dividends,
    withholdingTaxes,
    taxPeriod,
    symbolCountryMap: countryMap,
  });

  const summary = buildSummary({
    tradeResults,
    dividendResults,
    year: taxPeriod.year,
  });

  // Compute the loss-carry-forward breakdown once so the UI and PIT-38
  // builder agree on the deduction amount.
  const gainPln = Math.max(summary.totalProceedsPln - summary.totalCostPln, 0);
  const lossDeduction = applyLossCarryForward({
    gainPln,
    priorLosses: priorLosses ?? [],
    currentYear: taxPeriod.year,
  });

  const pit38 = buildPit38({ summary, priorLosses });
  const pitZg = buildPitZg({
    trades: tradeResults,
    dividends: dividendResults,
  });

  return {
    trades: tradeResults,
    dividends: dividendResults,
    summary,
    pit38,
    pitZg,
    lossDeduction,
  };
}

function buildSummary(args: {
  tradeResults: TradeResult[];
  dividendResults: DividendResult[];
  year: number;
}): TaxSummary {
  const sells = args.tradeResults.filter((t) => t.type === 'sell');

  const totalProceedsPln = sells.reduce((sum, t) => sum + t.proceedsPln, 0);
  const totalCostPln = sells.reduce((sum, t) => sum + t.costPln, 0);
  const capitalGainPln = totalProceedsPln - totalCostPln;
  const capitalGainTaxPln = Math.max(capitalGainPln, 0) * TAX_RATE;

  const totalDividendsPln = args.dividendResults.reduce(
    (sum, d) => sum + d.amountPln,
    0,
  );
  const totalWithholdingPln = args.dividendResults.reduce(
    (sum, d) => sum + d.withholdingTaxPln,
    0,
  );
  // Cap each dividend's deductible withholding at min(treaty rate, 19%) of its
  // gross PLN amount. art. 30a ust. 2 (stosowanie UPO) + art. 30a ust. 9
  // (krajowy cap 19%) ustawy o PIT. Excess foreign tax on one dividend cannot
  // offset tax owed on another dividend.
  const totalDeductibleWithholdingPln = args.dividendResults.reduce(
    (sum, d) =>
      sum +
      Math.min(
        d.withholdingTaxPln,
        d.amountPln * getDividendCreditCapRate({ country: d.country }),
      ),
    0,
  );
  const dividendTaxOwedPln = Math.max(
    totalDividendsPln * TAX_RATE - totalDeductibleWithholdingPln,
    0,
  );

  return {
    year: args.year,
    totalProceedsPln,
    totalCostPln,
    capitalGainPln,
    capitalGainTaxPln,
    totalDividendsPln,
    totalWithholdingPln,
    totalDeductibleWithholdingPln,
    dividendTaxOwedPln,
  };
}
