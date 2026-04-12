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
  type TaxPeriod,
  type TaxSummary,
  type TradeResult,
} from '../types.js';
import { calculateCapitalGains } from './capital-gains.js';
import { calculateDividends } from './dividends.js';
import { buildPitZg } from './pit-zg.js';
import { buildPit38 } from './pit38.js';

export interface CalculateTaxesArgs {
  trades: EnrichedTrade[];
  dividends: EnrichedRawDividend[];
  withholdingTaxes: EnrichedWithholdingTax[];
  corporateActions: EnrichedCorporateAction[];
  carryInPositions: CarryInPosition[];
  priorYearLoss?: number;
  taxPeriod: TaxPeriod;
  symbolCountryMap?: Map<string, string>;
}

export interface TaxCalculationResult {
  trades: TradeResult[];
  dividends: DividendResult[];
  summary: TaxSummary;
  pit38: Pit38Fields;
  pitZg: PitZgFields[];
}

/** Orchestrate full tax calculation pipeline */
export function calculateTaxes(args: CalculateTaxesArgs): TaxCalculationResult {
  const {
    trades,
    dividends,
    withholdingTaxes,
    corporateActions,
    carryInPositions,
    priorYearLoss,
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

  const pit38 = buildPit38({ summary, priorYearLoss });
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
  // Cap each dividend's deductible withholding at 19% of its gross PLN amount
  // per art. 30a ust. 9 ustawy o PIT — excess foreign tax cannot offset other dividends
  const totalDeductibleWithholdingPln = args.dividendResults.reduce(
    (sum, d) => sum + Math.min(d.withholdingTaxPln, d.amountPln * TAX_RATE),
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
