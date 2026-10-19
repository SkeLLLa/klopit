import {
  TAX_RATE,
  type EnrichedCarryInPosition,
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
import { calculateCapitalGains, type CarryInWarning } from './capital-gains.js';
import { calculateCreditInterest } from './credit-interest.js';
import { calculateDividends } from './dividends.js';
import { type ApplyLossCarryForwardResult } from './loss-carry-forward.js';
import { buildPitZg } from './pit-zg.js';
import { buildPit38, computeLossDeduction } from './pit38.js';

export interface CalculateTaxesArgs {
  trades: EnrichedTrade[];
  dividends: EnrichedRawDividend[];
  transactionFees?: TransactionFee[];
  creditInterests?: EnrichedCreditInterest[];
  withholdingTaxes: EnrichedWithholdingTax[];
  corporateActions: EnrichedCorporateAction[];
  carryInPositions: EnrichedCarryInPosition[];
  /**
   * Prior-year capital losses (art. 9 ust. 3 updof). Replaces the legacy
   * single-number `priorYearLoss` field — each year carries its own residual
   * and 50%-per-year cap.
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
  /** Carry-ins (partly) covered by imported prior-year trades. */
  carryInWarnings: CarryInWarning[];
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

  const carryInWarnings: CarryInWarning[] = [];
  const tradeResults = calculateCapitalGains({
    trades,
    corporateActions,
    carryInPositions,
    taxPeriod,
    symbolCountryMap: countryMap,
    onWarning: (warning) => carryInWarnings.push(warning),
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

  // Single source of truth for poz. 30: computed from the grosz-rounded
  // poz. 28 and shared by the summary, the breakdown and PIT-38.
  const lossDeduction = computeLossDeduction({
    trades: tradeResults,
    priorLosses: priorLosses ?? [],
    year: taxPeriod.year,
  });

  const summary = buildSummary({
    tradeResults,
    dividendResults,
    creditInterestResults,
    year: taxPeriod.year,
    lossDeduction,
    carryInWarnings,
  });

  const pit38 = buildPit38({
    trades: tradeResults,
    dividends: dividendResults,
    creditInterests: creditInterestResults,
    summary,
    priorLosses,
    lossDeduction,
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
    carryInWarnings,
  };
}

function buildSummary(args: {
  tradeResults: TradeResult[];
  dividendResults: DividendResult[];
  creditInterestResults: CreditInterestResult[];
  year: number;
  lossDeduction: ApplyLossCarryForwardResult;
  carryInWarnings: CarryInWarning[];
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
    missingRateCount:
      args.tradeResults.filter((r) => r.rateUnavailable).length +
      args.dividendResults.filter((r) => r.rateUnavailable).length +
      args.creditInterestResults.filter((r) => r.rateUnavailable).length,
    missingCostCount: args.tradeResults.filter((r) => r.costBasisMissing)
      .length,
    inconsistentCarryInCount: args.carryInWarnings.filter(
      (w) => w.kind === 'carry-in-inconsistent',
    ).length,
  };
}
