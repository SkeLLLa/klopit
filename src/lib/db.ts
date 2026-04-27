import Dexie, { type EntityTable } from 'dexie';
import type { ApplyLossCarryForwardResult } from '../core/tax/loss-carry-forward.js';
import type {
  CarryInPosition,
  CorporateAction,
  CreditInterestResult,
  DividendResult,
  ImportWarning,
  Pit38Fields,
  PitZgFields,
  PriorYearLoss,
  RawCreditInterest,
  RawDividend,
  RawWithholdingTax,
  Trade,
  TradeResult,
  TransactionFee,
} from '../core/types.js';
import { installStaleHooks } from './db-hooks.js';
import {
  renameInteractiveBrokersToIbkr,
  stripLegacyPriorYearLoss,
  type LegacySessionRecord,
  type SessionWithFiles,
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
  brokerCountry?: string;
  /** Bumped by Dexie hooks whenever source data tables change. */
  dataUpdatedAt?: Date;
  /** Set by calculateSessionTaxes on successful completion. */
  calculatedAt?: Date;
  /** Legacy PIT/ZG toggle retained only for database upgrades. */
  includeAllInPitZg?: boolean;
  /** Show dividend compatibility rows in PIT/ZG. Disabled by default. */
  showDividendsInPitZg?: boolean;
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

export interface CreditInterestRecord extends RawCreditInterest {
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

export interface CreditInterestResultRecord extends CreditInterestResult {
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
  totalCreditInterestPln: number;
  totalCreditInterestForeignTaxPln: number;
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
  creditInterests!: EntityTable<CreditInterestRecord, 'id'>;
  corporateActions!: EntityTable<CorporateActionRecord, 'id'>;
  priorLosses!: EntityTable<PriorYearLossRecord, 'id'>;
  tradeResults!: EntityTable<TradeResultRecord, 'id'>;
  dividendResults!: EntityTable<DividendResultRecord, 'id'>;
  creditInterestResults!: EntityTable<CreditInterestResultRecord, 'id'>;
  taxSummaries!: EntityTable<TaxSummaryRecord, 'sessionId'>;
  nbpRates!: EntityTable<NbpRateRecord, 'id'>;
  symbolCountryOverrides!: EntityTable<SymbolCountryOverrideRecord, 'id'>;

  constructor(name = 'klopit') {
    super(name);
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
    //
    // Tables are listed explicitly rather than via `tx.storeNames` because
    // Dexie reflects the *final* schema on the upgrade transaction, which
    // includes stores added in later versions (v8's creditInterests) that
    // haven't been physically created in IDB yet — `tx.table(name).clear()`
    // on those throws "Table <name> not part of transaction" and leaves the
    // database closed.
    this.version(7).upgrade(async (tx) => {
      const tablesAtV7 = [
        'sessions',
        'trades',
        'dividends',
        'corporateActions',
        'tradeResults',
        'dividendResults',
        'taxSummaries',
        'nbpRates',
        'withholdingTaxes',
        'carryInPositions',
        'transactionFees',
        'symbolCountryOverrides',
        'priorLosses',
      ];
      for (const name of tablesAtV7) {
        await tx.table(name).clear();
      }
    });
    this.version(8).stores({
      creditInterests: '++id, sessionId, date',
      creditInterestResults: '++id, sessionId, date',
    });
    // v9: shorten broker id 'interactive-brokers' to 'ibkr' on imported-file
    // records so pre-existing sessions align with the renamed BrokerId value.
    this.version(9).upgrade(async (tx) => {
      await tx
        .table<SessionWithFiles>('sessions')
        .toCollection()
        .modify(renameInteractiveBrokersToIbkr);
    });
    // v10: add compound indexes for efficient uniqueKeys() queries in
    // CountryMappingTable. [sessionId+symbol] lets us enumerate distinct
    // symbols per session without a full table scan; [sessionId+symbol+isin]
    // lets us enumerate distinct (symbol, isin) pairs in a single range query.
    // Both are additive-only — no data migration needed; Dexie auto-builds
    // the new index entries on existing records during upgrade.
    this.version(10).stores({
      trades:
        '++id, sessionId, symbol, datetime, [sessionId+symbol], [sessionId+symbol+isin]',
      dividends:
        '++id, sessionId, symbol, date, [sessionId+symbol], [sessionId+symbol+isin]',
    });
    this.version(11).stores({
      sessions: 'id, year',
    });
    // v12: PIT/ZG shape and old includeAllInPitZg semantics changed. Old
    // taxSummaries / result rows can keep stale PIT/ZG payloads that no
    // longer match the current calculator output, so invalidate derived
    // tables and force recalculation while preserving imported source data.
    this.version(12).upgrade(async (tx) => {
      await Promise.all([
        tx.table('tradeResults').clear(),
        tx.table('dividendResults').clear(),
        tx.table('creditInterestResults').clear(),
        tx.table('taxSummaries').clear(),
      ]);
      await tx
        .table<SessionRecord>('sessions')
        .toCollection()
        .modify((session) => {
          session.status = 'draft';
          session.calculatedAt = undefined;
          session.dataUpdatedAt = new Date();
        });
    });
    // v13: replace the old "include all income in PIT/ZG" option with a
    // narrower, disabled-by-default dividend compatibility option.
    this.version(13).upgrade(async (tx) => {
      await Promise.all([
        tx.table('tradeResults').clear(),
        tx.table('dividendResults').clear(),
        tx.table('creditInterestResults').clear(),
        tx.table('taxSummaries').clear(),
      ]);
      await tx
        .table<SessionRecord>('sessions')
        .toCollection()
        .modify((session) => {
          delete session.includeAllInPitZg;
          session.showDividendsInPitZg = false;
          session.status = 'draft';
          session.calculatedAt = undefined;
          session.dataUpdatedAt = new Date();
        });
    });
  }
}

export const db = new KlopitDB();

installStaleHooks(db);
