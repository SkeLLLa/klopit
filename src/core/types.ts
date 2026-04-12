/** Tax rate for capital gains and dividends (art. 30b ust. 1) */
export const TAX_RATE = 0.19;

// ---------------------------------------------------------------------------
// Broker identifiers
// ---------------------------------------------------------------------------

export const BrokerId = {
  InteractiveBrokers: 'interactive-brokers',
} as const;

export type BrokerId = (typeof BrokerId)[keyof typeof BrokerId];

// ---------------------------------------------------------------------------
// Parsed data (from broker CSV)
// ---------------------------------------------------------------------------

/** Raw trade from broker statement */
export interface Trade {
  symbol: string;
  isin?: string;
  currency: string;
  datetime: Date;
  quantity: number;
  price: number;
  proceeds: number;
  commission: number;
  commissionCurrency: string;
  type: 'buy' | 'sell';
}

/** Raw dividend income */
export interface RawDividend {
  symbol: string;
  isin?: string;
  currency: string;
  date: Date;
  amount: number;
}

/** Raw withholding tax on dividends */
export interface RawWithholdingTax {
  symbol: string;
  isin?: string;
  currency: string;
  date: Date;
  amount: number;
}

/** Corporate action */
export interface CorporateAction {
  type: 'stock-split' | 'merger';
  symbol: string;
  isin?: string;
  datetime: Date;
  // Stock split fields
  numerator: number;
  denominator: number;
  // Merger fields (only when type === 'merger')
  targetSymbol?: string;
  targetIsin?: string;
  conversionRatio?: number;
  cashPerShare?: number;
  cashCurrency?: string;
  /** Total cash received from merger (in original currency, from CSV Proceeds column) */
  cashTotalProceeds?: number;
  /** FMV of new shares received (in original currency, from CSV Value column) */
  newSharesValue?: number;
}

/** Carry-in position from prior year */
export interface CarryInPosition {
  symbol: string;
  isin?: string;
  quantity: number;
  year: number;
}

/** Transaction fee from broker (e.g. French transaction tax) */
export interface TransactionFee {
  symbol: string;
  isin?: string;
  currency: string;
  datetime: Date;
  amount: number;
  description: string;
}

/** Warning collected during parsing (non-fatal) */
export interface ParseWarning {
  line: number;
  section: string;
  message: string;
}

/** Result of parsing a single broker CSV file */
export interface ParsedStatement {
  broker: string;
  year: number;
  trades: Trade[];
  dividends: RawDividend[];
  withholdingTaxes: RawWithholdingTax[];
  corporateActions: CorporateAction[];
  carryInPositions: CarryInPosition[];
  transactionFees: TransactionFee[];
  symbolToIsin: Map<string, string>;
  warnings: ParseWarning[];
}

// ---------------------------------------------------------------------------
// Enriched data (after NBP rate lookup + FIFO calculation)
// ---------------------------------------------------------------------------

/** Trade with PLN conversion and FIFO cost basis */
export interface TradeResult {
  symbol: string;
  datetime: Date;
  type: 'buy' | 'sell';
  source: 'trade' | 'corporate-action';
  quantity: number;
  price: number;
  proceeds: number;
  commission: number;
  currency: string;
  exchangeRate: number;
  proceedsPln: number;
  costPln: number;
  gainLossPln: number;
  rateUnavailable: boolean;
  country: string;
}

/** Dividend with PLN conversion and matched withholding */
export interface DividendResult {
  symbol: string;
  currency: string;
  date: Date;
  amountOriginal: number;
  withholdingTaxOriginal: number;
  amountPln: number;
  withholdingTaxPln: number;
  exchangeRate: number;
  rateUnavailable: boolean;
  country: string;
}

/** Per-country PIT/ZG attachment fields */
export interface PitZgFields {
  country: string;
  // Section C — Capital gains per country
  proceedsPln: number;
  costPln: number;
  gainPln: number;
  lossPln: number;
  // Section D — Dividends per country
  dividendIncomePln: number;
  foreignTaxPaidPln: number;
  deductibleForeignTaxPln: number;
}

/** Aggregated tax summary for a year */
export interface TaxSummary {
  year: number;
  totalProceedsPln: number;
  totalCostPln: number;
  capitalGainPln: number;
  capitalGainTaxPln: number;
  totalDividendsPln: number;
  totalWithholdingPln: number;
  totalDeductibleWithholdingPln: number;
  dividendTaxOwedPln: number;
}

/**
 * Valid position numbers on the PIT-38(18) form.
 * Gaps (23, 32, 42) are tax-rate display rows — not stored as fields.
 */
export type Pit38Position =
  // Section C — Capital gains/losses (art. 30b ust. 1)
  | 20 // PIT-8C proceeds
  | 21 // PIT-8C costs
  | 22 // Other proceeds (foreign broker)
  | 24 // Exempt proceeds (art. 21.1.105a)
  | 25 // Exempt costs
  | 26 // Total proceeds (Razem)
  | 27 // Total costs (Razem)
  | 28 // Gain (dochod)
  | 29 // Loss (strata)
  // Section D — Tax calculation (art. 30b ust. 1)
  | 30 // Prior year losses
  | 31 // Tax base (podstawa)
  | 33 // Tax amount (podatek)
  | 34 // Foreign tax paid on capital gains
  | 35 // Tax due (podatek nalezny)
  // Section E — Crypto (art. 30b ust. 1a) — placeholders
  | 36 // Crypto proceeds
  | 37 // Crypto costs (current year)
  | 38 // Crypto costs (prior years)
  | 39 // Crypto gain
  | 40 // Crypto undeducted costs
  // Section F — Crypto tax (art. 30b ust. 1a) — placeholders
  | 41 // Crypto tax base
  | 43 // Crypto tax amount
  | 44 // Crypto foreign tax paid
  | 45 // Crypto tax due
  // Section G — Payment summary
  | 46 // Flat-rate tax (art. 29, 30, 30a)
  | 47 // Foreign dividend tax (art. 30a ust. 1 pkt 1-5)
  | 48 // Foreign tax paid on dividends
  | 49 // Difference (poz47 - poz48)
  | 50 // Advance payments by payers
  | 51 // TAX TO PAY
  | 52 // OVERPAYMENT
  // Section H — Monthly flat-rate tax (art. 44 ust. 1b) — placeholders
  | 53
  | 54
  | 55
  | 56
  | 57
  | 58
  | 59
  | 60
  | 61
  | 62
  | 63
  | 64
  // Section I — Art. 45 ust. 3c — placeholder
  | 65;

/** Direct mapping to PIT-38(18) form fields. Key = position number on the form. */
export type Pit38Fields = Record<Pit38Position, number>;

// ---------------------------------------------------------------------------
// Tax period
// ---------------------------------------------------------------------------

export interface TaxPeriod {
  year: number;
  from: Date;
  to: Date;
}

// ---------------------------------------------------------------------------
// Enriched data (with pre-resolved exchange rates from service layer)
// ---------------------------------------------------------------------------

/** Trade with pre-resolved exchange rate */
export interface EnrichedTrade extends Trade {
  exchangeRate: number;
  commissionExchangeRate: number;
  rateUnavailable: boolean;
}

/** Dividend with pre-resolved exchange rate */
export interface EnrichedRawDividend extends RawDividend {
  exchangeRate: number;
  rateUnavailable: boolean;
}

/** Withholding tax with pre-resolved exchange rate */
export interface EnrichedWithholdingTax extends RawWithholdingTax {
  exchangeRate: number;
  rateUnavailable: boolean;
}

/** Corporate action with pre-resolved exchange rate for cash component */
export interface EnrichedCorporateAction extends CorporateAction {
  cashExchangeRate: number;
  cashRateUnavailable: boolean;
}
