import {
  TAX_RATE,
  type CarryInPosition,
  type CreditInterestResult,
  type DividendResult,
  type EnrichedCorporateAction,
  type EnrichedCreditInterest,
  type EnrichedRawDividend,
  type EnrichedTrade,
  type EnrichedWithholdingTax,
  type Pit38Fields,
  type PitZgFields,
  type PriorYearLoss,
  type TaxPeriod,
  type TaxSummary,
  type TradeResult,
  type TransactionFee,
} from '../types.js';
import {
  sumCost,
  sumCreditInterestForeignTax,
  sumCreditInterestIncome,
  sumDeductibleWithholding,
  sumDividendIncome,
  sumProceeds,
  sumWithholding,
} from './aggregates.js';
import { calculateCapitalGains } from './capital-gains.js';
import { calculateCreditInterest } from './credit-interest.js';
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
  transactionFees?: TransactionFee[];
  creditInterests?: EnrichedCreditInterest[];
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
  showDividendsInPitZg?: boolean;
  reduceAdrFeesFromDividends?: boolean;
}

export interface TaxCalculationResult {
  trades: TradeResult[];
  dividends: DividendResult[];
  creditInterests: CreditInterestResult[];
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
    transactionFees = [],
    creditInterests = [],
    withholdingTaxes,
    corporateActions,
    carryInPositions,
    priorLosses,
    taxPeriod,
    showDividendsInPitZg,
    reduceAdrFeesFromDividends,
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
    transactionFees,
    reduceAdrFeesFromDividends: reduceAdrFeesFromDividends ?? false,
    taxPeriod,
    symbolCountryMap: countryMap,
  });
  const creditInterestResults = calculateCreditInterest({
    creditInterests,
    taxPeriod,
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
    creditInterestResults,
    year: taxPeriod.year,
    lossDeduction,
  });

  const pit38 = buildPit38({
    trades: tradeResults,
    dividends: dividendResults,
    creditInterests: creditInterestResults,
    summary,
    priorLosses,
  });
  const pitZg = buildPitZg({
    trades: tradeResults,
    dividends: dividendResults,
    showDividends: showDividendsInPitZg ?? false,
  });

  return {
    trades: tradeResults,
    dividends: dividendResults,
    creditInterests: creditInterestResults,
    summary,
    pit38,
    pitZg,
    lossDeduction,
  };
}

function buildSummary(args: {
  tradeResults: TradeResult[];
  dividendResults: DividendResult[];
  creditInterestResults: CreditInterestResult[];
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
  const totalCreditInterestPln = sumCreditInterestIncome({
    rows: args.creditInterestResults,
  });
  const totalCreditInterestForeignTaxPln = sumCreditInterestForeignTax({
    rows: args.creditInterestResults,
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
    totalCreditInterestPln,
    totalCreditInterestForeignTaxPln,
    capitalGainAfterLcfPln,
    capitalGainTaxPostLcfPln,
  };
}
