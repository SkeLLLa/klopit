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
import {
  sumCost,
  sumDeductibleWithholding,
  sumDividendIncome,
  sumProceeds,
  sumWithholding,
} from './aggregates.js';
import { calculateCapitalGains } from './capital-gains.js';
import { calculateDividends } from './dividends.js';
import {
  applyLossCarryForward,
  type ApplyLossCarryForwardResult,
} from './loss-carry-forward.js';
import { buildPitZg } from './pit-zg.js';
import { buildPit38 } from './pit38.js';

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

  const gainPln = Math.max(
    sumProceeds({ rows: tradeResults }) - sumCost({ rows: tradeResults }),
    0,
  );
  const lossDeduction = applyLossCarryForward({
    gainPln,
    priorLosses: priorLosses ?? [],
    currentYear: taxPeriod.year,
  });

  const summary = buildSummary({
    tradeResults,
    dividendResults,
    year: taxPeriod.year,
    lossDeduction,
  });

  const pit38 = buildPit38({
    trades: tradeResults,
    dividends: dividendResults,
    summary,
    priorLosses,
  });
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
  lossDeduction: ApplyLossCarryForwardResult;
}): TaxSummary {
  const totalProceedsPln = sumProceeds({ rows: args.tradeResults });
  const totalCostPln = sumCost({ rows: args.tradeResults });
  const capitalGainPln = totalProceedsPln - totalCostPln;
  const capitalGainTaxPln = Math.max(capitalGainPln, 0) * TAX_RATE;

  const totalDividendsPln = sumDividendIncome({ rows: args.dividendResults });
  const totalWithholdingPln = sumWithholding({ rows: args.dividendResults });
  const totalDeductibleWithholdingPln = sumDeductibleWithholding({
    rows: args.dividendResults,
  });
  const dividendTaxOwedPln = Math.max(
    totalDividendsPln * TAX_RATE - totalDeductibleWithholdingPln,
    0,
  );

  const capitalGainAfterLcfPln = Math.max(
    Math.max(capitalGainPln, 0) - args.lossDeduction.deductedPln,
    0,
  );
  const capitalGainTaxPostLcfPln = capitalGainAfterLcfPln * TAX_RATE;

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
    capitalGainAfterLcfPln,
    capitalGainTaxPostLcfPln,
  };
}
