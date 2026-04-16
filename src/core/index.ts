// Types
export type {
  Trade,
  RawDividend,
  RawWithholdingTax,
  RawCreditInterest,
  CorporateAction,
  CarryInPosition,
  TransactionFee,
  ParsedStatement,
  TradeResult,
  DividendResult,
  CreditInterestResult,
  TaxSummary,
  Pit38Fields,
  TaxPeriod,
  EnrichedTrade,
  EnrichedRawDividend,
  EnrichedWithholdingTax,
  EnrichedCreditInterest,
} from './types.js';
export { TAX_RATE } from './types.js';

// NBP rates
export { fetchRate, fetchRates } from './nbp.js';
export type { NbpRate, NbpRateMap, NbpRateResult } from './nbp.js';

// Parsers
export type { StatementParser, ParserDefinition } from './parsers/types.js';
export { getParserDefinition, supportedBrokers } from './parsers/registry.js';
export { BrokerId } from './types.js';
export type { ParseWarning } from './types.js';

// Tax calculation
export { calculateTaxes } from './tax/calculator.js';
export type { TaxCalculationResult } from './tax/calculator.js';
export { applyStockSplit, applyMerger } from './tax/corporate-actions.js';
export type { FifoLot, MergerResult } from './tax/corporate-actions.js';
export { buildPit38 } from './tax/pit38.js';
export { roundToFullPln, roundToGroszUp } from './tax/rounding.js';

// Portfolio
export { analyzePortfolio } from './portfolio/analyzer.js';
