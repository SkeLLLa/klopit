import Dexie, { type EntityTable } from 'dexie';
import type { ApplyLossCarryForwardResult } from '../core/tax/loss-carry-forward.js';
import type {
  CarryInPosition,
  CorporateAction,
  DividendResult,
  ImportWarning,
  Pit38Fields,
  PitZgFields,
  PriorYearLoss,
  RawDividend,
  RawWithholdingTax,
  Trade,
  TradeResult,
  TransactionFee,
} from '../core/types.js';
import { installStaleHooks } from './db-hooks.js';
import {
  stripLegacyPriorYearLoss,
  type LegacySessionRecord,
} from './db-migrations.js';

// ---------------------------------------------------------------------------
// Database record types (extend domain types with DB-specific fields)
// ---------------------------------------------------------------------------

export interface SessionRecord {
  id: string;
  year: number;
  createdAt: Date;
  updatedAt: Date;
  files: ImportedFileRecord[];
  residencyStartDate?: Date;
  status: 'draft' | 'calculated';
  oppKrs?: string;
  oppDetails?: string;
  oppConsent?: boolean;
  importWarnings?: ImportWarning[];
  /** Bumped by Dexie hooks whenever source data tables change. */
  dataUpdatedAt?: Date;
  /** Set by calculateSessionTaxes on successful completion. */
  calculatedAt?: Date;
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

export interface PriorYearLossRecord extends PriorYearLoss {
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
  capitalGainAfterLcfPln: number;
  capitalGainTaxPostLcfPln: number;
  pit38: Pit38Fields;
  pitZg: PitZgFields[];
  /**
   * Per-year loss-carry-forward breakdown (art. 9 ust. 3 updof). Only set
   * when the calculation considered prior-year losses.
   */
  lossDeduction?: ApplyLossCarryForwardResult;
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

export class KlopitDB extends Dexie {
  sessions!: EntityTable<SessionRecord, 'id'>;
  trades!: EntityTable<TradeRecord, 'id'>;
  dividends!: EntityTable<DividendRecord, 'id'>;
  withholdingTaxes!: EntityTable<WithholdingTaxRecord, 'id'>;
  carryInPositions!: EntityTable<CarryInPositionRecord, 'id'>;
  transactionFees!: EntityTable<TransactionFeeRecord, 'id'>;
  corporateActions!: EntityTable<CorporateActionRecord, 'id'>;
  priorLosses!: EntityTable<PriorYearLossRecord, 'id'>;
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
    this.version(4).stores({
      sessions: 'id, year',
    });
    this.version(5).upgrade(async (tx) => {
      // Backfill calculatedAt for sessions that were marked 'calculated'
      // before the v4 schema introduced the timestamp. Without this, the
      // stale-recalculation UI has no baseline and keeps the recalc button
      // hidden forever for pre-existing sessions.
      await tx
        .table<SessionRecord>('sessions')
        .toCollection()
        .modify((s) => {
          if (s.status === 'calculated' && !s.calculatedAt) {
            s.calculatedAt = s.updatedAt;
          }
        });
    });
    // v6: replace the legacy single-number `priorYearLoss` field on
    // sessions with a dedicated `priorLosses` table that captures one row
    // per loss-year (art. 9 ust. 3 updof: 5-year window + 50%-per-year cap).
    this.version(6)
      .stores({
        priorLosses: '++id, sessionId, year, [sessionId+year]',
      })
      .upgrade(async (tx) => {
        await tx
          .table<LegacySessionRecord>('sessions')
          .toCollection()
          .modify(stripLegacyPriorYearLoss);
      });
    // v7: wipe database — per-row tax fields added to DividendResult
    // (creditCapRate, deductibleWithholdingPln, taxPlnGross, taxToPayPln),
    // TradeResult (taxPln), and TaxSummary (post-LCF fields).
    this.version(7).upgrade(async (tx) => {
      const tableNames = tx.storeNames;
      for (const name of tableNames) {
        await tx.table(name).clear();
      }
    });
  }
}

export const db = new KlopitDB();

installStaleHooks(db);
