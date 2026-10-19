import { Dexie, type EntityTable } from 'dexie';

import type { CarryInWarning } from '../core/tax/capital-gains.js';
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
  buildSessionSymbolIsinMap,
  migrateCarryInPositionV14,
  needsPerAccountFifoNotice,
  renameInteractiveBrokersToIbkr,
  stripLegacyPriorYearLoss,
  type LegacyCarryInRow,
  type LegacySessionRecord,
  type LegacyCorporateActionIsinRow,
  type LegacyTradeIsinRow,
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
  residencyStartDate?: Date | undefined;
  status: 'draft' | 'calculated';
  oppKrs?: string | undefined;
  oppDetails?: string | undefined;
  oppConsent?: boolean | undefined;
  importWarnings?: ImportWarning[] | undefined;
  brokerCountry?: string | undefined;
  /** Bumped by Dexie hooks whenever source data tables change. */
  dataUpdatedAt?: Date | undefined;
  /** Set by calculateSessionTaxes on successful completion. */
  calculatedAt?: Date | undefined;
  /** Legacy PIT/ZG toggle retained only for database upgrades. */
  includeAllInPitZg?: boolean | undefined;
  /** Show dividend compatibility rows in PIT/ZG. Disabled by default. */
  showDividendsInPitZg?: boolean | undefined;
  /**
   * Subtract parsed ADR/GDR fees from matched dividend income. Disabled by
   * default.
   */
  reduceAdrFeesFromDividends?: boolean | undefined;
  /**
   * Use estimated T+2 settlement dates for trade NBP rate lookups. Disabled by
   * default.
   */
  useSettlementDateForTradeRates?: boolean | undefined;
  /** The "re-import Schwab statements for FMV data" notice was dismissed. */
  schwabFmvNoticeDismissed?: boolean | undefined;
  /**
   * Set by the v16 upgrade on sessions that mix several brokers / accounts:
   * FIFO now runs per account, so their results may have changed. Cleared when
   * the user dismisses the notice. Never set on sessions created after v16.
   */
  perAccountFifoNoticePending?: boolean | undefined;
}

export interface ImportedFileRecord {
  name: string;
  broker: string;
  size: number;
  importedAt: Date;
}

export interface TradeRecord extends Trade {
  id?: number | undefined;
  sessionId: string;
}

export interface DividendRecord extends RawDividend {
  id?: number | undefined;
  sessionId: string;
  withholdingTax: number;
}

export interface WithholdingTaxRecord extends RawWithholdingTax {
  id?: number | undefined;
  sessionId: string;
}

export interface CarryInPositionRecord extends CarryInPosition {
  id?: number | undefined;
  sessionId: string;
}

export interface TransactionFeeRecord extends TransactionFee {
  id?: number | undefined;
  sessionId: string;
}

export interface CreditInterestRecord extends RawCreditInterest {
  id?: number | undefined;
  sessionId: string;
}

export interface CorporateActionRecord extends CorporateAction {
  id?: number | undefined;
  sessionId: string;
}

export interface PriorYearLossRecord extends PriorYearLoss {
  id?: number | undefined;
  sessionId: string;
}

export interface SymbolCountryOverrideRecord {
  id?: number | undefined;
  sessionId: string;
  symbol: string;
  country: string;
  /** Which attribution the override applies to. Missing = 'both'. */
  scope?: 'dividends' | 'gains' | 'both';
}

export interface TradeResultRecord extends TradeResult {
  id?: number | undefined;
  sessionId: string;
}

export interface DividendResultRecord extends DividendResult {
  id?: number | undefined;
  sessionId: string;
}

export interface CreditInterestResultRecord extends CreditInterestResult {
  id?: number | undefined;
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
  /** See TaxSummary.totalDividendAddBackPln. Absent on older summaries. */
  totalDividendAddBackPln?: number | undefined;
  totalCreditInterestPln: number;
  totalCreditInterestForeignTaxPln: number;
  capitalGainAfterLcfPln: number;
  capitalGainTaxPostLcfPln: number;
  /**
   * Results with a missing NBP rate (see TaxSummary.missingRateCount). Absent
   * on summaries saved before this field existed — treat as unknown.
   */
  missingRateCount?: number | undefined;
  /** See TaxSummary.missingCostCount. Absent on older summaries. */
  missingCostCount?: number | undefined;
  /** See TaxSummary.inconsistentCarryInCount. Absent on older summaries. */
  inconsistentCarryInCount?: number | undefined;
  /** See TaxSummary.unassignedOverlapCount. Absent on older summaries. */
  unassignedOverlapCount?: number | undefined;
  pit38: Pit38Fields;
  pitZg: PitZgFields[];
  /**
   * Per-year loss-carry-forward breakdown (art. 9 ust. 3 updof). Only set when
   * the calculation considered prior-year losses.
   */
  lossDeduction?: ApplyLossCarryForwardResult | undefined;
  /** Carry-in reconciliation findings (overlap, inconsistent snapshot, ...). */
  carryInWarnings?: CarryInWarning[] | undefined;
}

export interface NbpRateRecord {
  id: string; // "{currency}:{YYYY-MM-DD}"
  currency: string;
  date: string;
  rate: number | null;
  table: string;
  /**
   * Warsaw calendar day (YYYY-MM-DD) the record was fetched. A `null` rate is
   * trusted as a weekend/holiday only when `fetchedAt > date`; legacy records
   * without it are revalidated.
   */
  fetchedAt?: string | undefined;
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

/** Row shape the v16 upgrade reads: only the owning session and account. */
export interface LegacyAccountRow {
  sessionId: string;
  account?: string | undefined;
}

/*
 * Schema upgrade policy (CONTRIBUTING.md, "Database Schema Upgrades"):
 * - Input tables (INPUT_TABLES) are never cleared or dropped by an upgrade.
 * - Derived data (DERIVED_TABLES) may be invalidated; affected sessions must
 *   then be marked stale or reset to 'draft' so results are recomputed.
 * - Every version bump must update the lists in `db-tables.ts` and extend
 *   `test/db-input-preservation.test.ts` with the new N-1 -> N step.
 */
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
      await Promise.all(
        tablesAtV7.map((tableName) => tx.table(tableName).clear()),
      );
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
    // v14: carry-in positions gained cost basis / acquisition date and are
    // matched to sells by ISIN. Non-destructive: backfill ISINs from
    // same-session trades, mark rows without cost as `missing`, and
    // invalidate results that were computed with a silent cost of 0.
    this.version(14).upgrade(async (tx) => {
      const trades = await tx.table<LegacyTradeIsinRow>('trades').toArray();
      const actions = await tx
        .table<LegacyCorporateActionIsinRow>('corporateActions')
        .toArray();
      const isinMap = buildSessionSymbolIsinMap(trades, actions);
      await tx
        .table<LegacyCarryInRow>('carryInPositions')
        .toCollection()
        .modify((row) => {
          migrateCarryInPositionV14(row, isinMap);
        });
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
    // v15: cached `rate: null` NBP entries
    // could be "not yet published" days stored as holidays, which made later
    // lookups walk back to an older rate. Drop all cached nulls (cheap to
    // refetch; real rates are kept) and flag calculated sessions as stale so
    // the recalculation prompt appears. Source and result tables are kept.
    this.version(15).upgrade(async (tx) => {
      await tx
        .table<NbpRateRecord>('nbpRates')
        .filter((r) => r.rate === null)
        .delete();
      await tx
        .table<SessionRecord>('sessions')
        .toCollection()
        .modify((session) => {
          if (session.status === 'calculated') {
            session.dataUpdatedAt = new Date();
          }
        });
    });
    // v16: plan-10 data and calculation changes shipped together: poz. 49
    // rounding, gross proceeds with commission moved into cost, per-lot
    // incentive regime, ADR / PIL dividend country and override scopes, the
    // optional `account` field with per-account FIFO (art. 24 ust. 10 updof),
    // transfers stored as `corporateActions` rows of type 'transfer', and
    // dated carry-in placement. All new fields are optional and unindexed
    // (`account` is not queried by index), so no schema change and no row is
    // rewritten. Calculated sessions are marked stale (`calculatedAt` is kept,
    // `dataUpdatedAt` bumped, as in v15) so the stale banner and recalculate
    // button appear; sessions that mix several brokers / accounts also get a
    // one-time notice, as their results can change.
    this.version(16).upgrade(async (tx) => {
      const accounts = new Map<string, Set<string>>();
      await Promise.all(
        ['trades', 'carryInPositions', 'dividends'].map((table) =>
          tx
            .table<LegacyAccountRow>(table)
            .toCollection()
            .each((row) => {
              if (!row.account) return;
              const set = accounts.get(row.sessionId) ?? new Set<string>();
              set.add(row.account);
              accounts.set(row.sessionId, set);
            }),
        ),
      );
      await tx
        .table<SessionRecord>('sessions')
        .toCollection()
        .modify((session) => {
          if (session.status === 'calculated') {
            session.dataUpdatedAt = new Date();
          }
          if (
            needsPerAccountFifoNotice({
              files: session.files,
              accounts: [...(accounts.get(session.id) ?? [])],
            })
          ) {
            session.perAccountFifoNoticePending = true;
          }
        });
    });
    // v17: plan-13 calculation changes (cross-date dividend matching,
    // unmatched withholding, art. 45 ust. 3a add-back, foreign tax on gains in
    // PIT-38 poz. 34 and the art. 30b ust. 5a cap). `Trade.foreignTax` and
    // `foreignTaxDate` are optional and unindexed, so no schema change and no
    // row is rewritten. Calculated sessions are marked stale the v15 way
    // (`calculatedAt` kept, `dataUpdatedAt` bumped).
    this.version(17).upgrade(async (tx) => {
      await tx
        .table<SessionRecord>('sessions')
        .toCollection()
        .modify((session) => {
          if (session.status === 'calculated') {
            session.dataUpdatedAt = new Date();
          }
        });
    });
  }
}

export const db = new KlopitDB();

installStaleHooks(db);
