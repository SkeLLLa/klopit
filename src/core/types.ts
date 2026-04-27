/** Tax rate for capital gains and dividends (art. 30b ust. 1) */
export const TAX_RATE = 0.19;

// ---------------------------------------------------------------------------
// Broker identifiers
// ---------------------------------------------------------------------------

export const BrokerId = {
  InteractiveBrokers: 'ibkr',
  IbiCapital: 'ibi',
  Schwab: 'schwab',
} as const;

export type BrokerId = (typeof BrokerId)[keyof typeof BrokerId];

// ---------------------------------------------------------------------------
// Parsed data (from broker CSV)
// ---------------------------------------------------------------------------

/**
 * Origin tag attached to a parsed trade. Defaults to `'trade'` (regular
 * broker transaction) when omitted. Parsers that produce synthetic lots
 * from employee-share-purchase programs set `'espp'`; parsers that produce
 * synthetic lots from restricted stock unit plans set `'rsu'`. Both keep
 * the buy + sell legs visible and tagged in the output.
 */
export type TradeSource = 'trade' | 'espp' | 'rsu';

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
  /** Origin of this trade; absent means regular trade. */
  source?: TradeSource;
  /**
   * Optional lot partition key. When set, FIFO treats this trade as living
   * in a separate queue keyed by (symbol|isin, lotId), bypassing the global
   * per-security FIFO. Used by IBI ESPP where each order pairs a specific
   * grant-purchase with its own sell — grants can be bought and sold in any
   * interleaving, so commingling them through a single FIFO queue mis-
   * allocates per-transaction P&L even though the annual tax total is the
   * same. Parsers that don't populate this field leave `lotKey` at its
   * default symbol/ISIN value.
   */
  lotId?: string;
  /**
   * Optional plan identifier (e.g. "MNDY ESPP"). Audit metadata; no
   * effect on tax computation. Currently set only by the IBI parsers.
   */
  plan?: string;
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

/**
 * A capital-loss carried in from a prior tax year.
 *
 * Per art. 9 ust. 3 updof, a loss reported in year `year` may be deducted
 * from gains in the next 5 tax years, with at most 50% of the original
 * loss applied in any single year.
 *
 * - `totalLossPln` — the original loss amount reported on PIT-38 poz29 for `year`.
 * - `alreadyDeductedPln` — cumulative amount already deducted in prior years
 *   (across all sessions). Used to track the residual available for the
 *   current calculation.
 */
export interface PriorYearLoss {
  year: number;
  totalLossPln: number;
  alreadyDeductedPln: number;
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

/** Raw credit interest from broker statement (art. 30a ust. 1 pkt 3) */
export interface RawCreditInterest {
  currency: string;
  date: Date;
  amount: number;
  description: string;
}

/** Warning collected during parsing (non-fatal) */
export interface ParseWarning {
  line: number;
  section: string;
  message: string;
}

/** Classification of a CSV row that the parser intentionally skipped. */
export type SkippedRowKind = 'known-unsupported' | 'unknown' | 'parse-failure';

/**
 * A single CSV row that was skipped by the parser, retained for post-import
 * inspection. In-memory only (lost on page reload).
 */
export interface SkippedRow {
  section: string;
  kind: SkippedRowKind;
  /** 1-based line number in the CSV as fed to the parser. */
  line: number;
  assetCategory?: string;
  currency?: string;
  symbol?: string;
  /** Raw datetime string as it appeared in the CSV. */
  datetime?: string;
  description?: string;
  /** Exact raw CSV line, verbatim. */
  rawLine: string;
}

/** Persistent summary of skipped rows grouped by section and kind. */
export interface ImportWarning {
  section: string;
  kind: SkippedRowKind;
  rowCount: number;
  message: string;
}

/** Result of parsing a single broker CSV file */
export interface ParsedStatement {
  broker: string;
  brokerCountry?: string;
  year: number;
  trades: Trade[];
  dividends: RawDividend[];
  withholdingTaxes: RawWithholdingTax[];
  corporateActions: CorporateAction[];
  carryInPositions: CarryInPosition[];
  transactionFees: TransactionFee[];
  creditInterests: RawCreditInterest[];
  symbolToIsin: Map<string, string>;
  warnings: ParseWarning[];
  skippedRows: SkippedRow[];
}

// ---------------------------------------------------------------------------
// Enriched data (after NBP rate lookup + FIFO calculation)
// ---------------------------------------------------------------------------

/** Trade with PLN conversion and FIFO cost basis */
export interface TradeResult {
  symbol: string;
  datetime: Date;
  type: 'buy' | 'sell';
  source: TradeSource | 'corporate-action';
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
  /** Pre-LCF per-trade tax: max(gainLossPln, 0) * 0.19. Display-only. */
  taxPln: number;
  /** Foreign tax paid on this trade in PLN (default 0). */
  foreignTaxPln: number;
  /** Foreign tax paid in original currency (default 0). */
  foreignTaxOriginal: number;
}

/** Warning on a dividend result */
export type DividendWarning =
  | {
      kind: 'wht-lapse';
    }
  | {
      kind: 'unknown-country';
    };

/** Dividend with PLN conversion and matched withholding */
export interface DividendResult {
  symbol: string;
  currency: string;
  date: Date;
  /** Dividend amount used as the Polish tax base after optional adjustments. */
  amountOriginal: number;
  withholdingTaxOriginal: number;
  /** ADR/GDR fees subtracted from the dividend base when the compatibility setting is enabled. */
  adrFeeOriginal?: number;
  adrFeePln?: number;
  amountPln: number;
  withholdingTaxPln: number;
  exchangeRate: number;
  rateUnavailable: boolean;
  country: string;
  /** Resolved treaty cap rate at calc time (e.g. 0.15 for US). */
  creditCapRate: number;
  /** Treaty-capped deductible withholding: min(withholdingTaxPln, amountPln * creditCapRate). */
  deductibleWithholdingPln: number;
  /** Gross PL tax on this dividend: amountPln * 0.19. */
  taxPlnGross: number;
  /** Net tax to pay: max(taxPlnGross - deductibleWithholdingPln, 0). */
  taxToPayPln: number;
  warnings?: DividendWarning[];
}

/** Credit interest result after tax calculation (art. 30a ust. 1 pkt 3) */
export interface CreditInterestResult {
  currency: string;
  date: Date;
  description: string;
  amountOriginal: number;
  amountPln: number;
  exchangeRate: number;
  fxDate: string;
  rateUnavailable: boolean;
  taxPlnGross: number;
  foreignTaxOriginal: number;
  foreignTaxPln: number;
  foreignTaxExchangeRate: number;
}

/**
 * Per-country PIT/ZG attachment fields.
 *
 * PIT-38 attachments use PIT/ZG section C.3 for income and foreign tax
 * under art. 30b. Foreign dividends are art. 30a flat-rate income and stay
 * in PIT-38 section G by default. They are included here only when the
 * session's `showDividendsInPitZg` compatibility setting is enabled.
 */
export interface PitZgFields {
  country: string;
  countryNamePl: string;

  // Capital gains / share income (PIT/ZG C.3, present for sell trades)
  proceedsPln?: number;
  costPln?: number;
  gainPln?: number;
  lossPln?: number;
  tradeForeignTaxPln?: number;

  // Optional dividend compatibility section
  dividendIncomePln?: number;
  dividendForeignTaxPln?: number;
  deductibleDividendTaxPln?: number;
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
  totalCreditInterestPln: number;
  totalCreditInterestForeignTaxPln: number;
  /** Capital gain after prior-year loss deduction: max(gain - lcfDeducted, 0). */
  capitalGainAfterLcfPln: number;
  /** Post-LCF capital gain tax (raw, unrounded): capitalGainAfterLcfPln * 0.19. */
  capitalGainTaxPostLcfPln: number;
}

/**
 * Valid position numbers on the PIT-38(18) form.
 * Gaps (32, 42) are tax-rate display rows — not stored as fields.
 */
export type Pit38Position =
  // Section C — Capital gains/losses (art. 30b ust. 1)
  | 20 // PIT-8C proceeds
  | 21 // PIT-8C costs
  | 22 // Other proceeds (foreign broker)
  | 23 // Other costs (foreign broker)
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

/** Credit interest with pre-resolved exchange rate */
export interface EnrichedCreditInterest extends RawCreditInterest {
  exchangeRate: number;
  rateUnavailable: boolean;
}
