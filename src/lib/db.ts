import Dexie, { type EntityTable } from 'dexie';
import type {
  CarryInPosition,
  CorporateAction,
  DividendResult,
  Pit38Fields,
  PitZgFields,
  RawDividend,
  RawWithholdingTax,
  Trade,
  TradeResult,
  TransactionFee,
} from '../core/types.js';

// ---------------------------------------------------------------------------
// Database record types (extend domain types with DB-specific fields)
// ---------------------------------------------------------------------------

export interface SessionRecord {
  id: string;
  year: number;
  createdAt: Date;
  updatedAt: Date;
  files: ImportedFileRecord[];
  priorYearLoss?: number;
  residencyStartDate?: Date;
  status: 'draft' | 'calculated';
  oppKrs?: string;
  oppDetails?: string;
  oppConsent?: boolean;
}

export interface ImportedFileRecord {
  name: string;
  broker: string;
  size: number;
  importedAt: Date;
}

export interface TradeRecord extends Trade {
  id?: number;
  sessionId: string;
}

export interface DividendRecord extends RawDividend {
  id?: number;
  sessionId: string;
  withholdingTax: number;
}

export interface WithholdingTaxRecord extends RawWithholdingTax {
  id?: number;
  sessionId: string;
}

export interface CarryInPositionRecord extends CarryInPosition {
  id?: number;
  sessionId: string;
}

export interface TransactionFeeRecord extends TransactionFee {
  id?: number;
  sessionId: string;
}

export interface CorporateActionRecord extends CorporateAction {
  id?: number;
  sessionId: string;
}

export interface SymbolCountryOverrideRecord {
  id?: number;
  sessionId: string;
  symbol: string;
  country: string;
}

export interface TradeResultRecord extends TradeResult {
  id?: number;
  sessionId: string;
}

export interface DividendResultRecord extends DividendResult {
  id?: number;
  sessionId: string;
}

export interface TaxSummaryRecord {
  sessionId: string;
  year: number;
  totalProceedsPln: number;
  totalCostPln: number;
  capitalGainPln: number;
  capitalGainTaxPln: number;
  totalDividendsPln: number;
  totalWithholdingPln: number;
  totalDeductibleWithholdingPln: number;
  dividendTaxOwedPln: number;
  pit38: Pit38Fields;
  pitZg: PitZgFields[];
}

export interface NbpRateRecord {
  id: string; // "{currency}:{YYYY-MM-DD}"
  currency: string;
  date: string;
  rate: number | null;
  table: string;
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

class KlopitDB extends Dexie {
  sessions!: EntityTable<SessionRecord, 'id'>;
  trades!: EntityTable<TradeRecord, 'id'>;
  dividends!: EntityTable<DividendRecord, 'id'>;
  withholdingTaxes!: EntityTable<WithholdingTaxRecord, 'id'>;
  carryInPositions!: EntityTable<CarryInPositionRecord, 'id'>;
  transactionFees!: EntityTable<TransactionFeeRecord, 'id'>;
  corporateActions!: EntityTable<CorporateActionRecord, 'id'>;
  tradeResults!: EntityTable<TradeResultRecord, 'id'>;
  dividendResults!: EntityTable<DividendResultRecord, 'id'>;
  taxSummaries!: EntityTable<TaxSummaryRecord, 'sessionId'>;
  nbpRates!: EntityTable<NbpRateRecord, 'id'>;
  symbolCountryOverrides!: EntityTable<SymbolCountryOverrideRecord, 'id'>;

  constructor() {
    super('klopit');
    this.version(1).stores({
      sessions: 'id, year',
      trades: '++id, sessionId, symbol, datetime',
      dividends: '++id, sessionId, symbol, date',
      corporateActions: '++id, sessionId, datetime',
      tradeResults: '++id, sessionId, symbol, datetime',
      dividendResults: '++id, sessionId, symbol, date',
      taxSummaries: 'sessionId',
      nbpRates: 'id, currency, date',
    });
    this.version(2).stores({
      withholdingTaxes: '++id, sessionId, symbol, date',
      carryInPositions: '++id, sessionId, symbol',
      transactionFees: '++id, sessionId, symbol, datetime',
    });
    this.version(3).stores({
      symbolCountryOverrides: '++id, sessionId, symbol',
    });
  }
}

export const db = new KlopitDB();
