import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import Dexie from 'dexie';
import { KlopitDB } from '../src/lib/db.js';

/**
 * Integration test: `KlopitDB` must be openable against a database
 * previously created at an earlier schema version. Regression guard for
 * "NotFoundError Table creditInterests not part of transaction", caused
 * by v7's upgrade iterating `tx.storeNames`, which reflected the *final*
 * (v9) schema including stores that v8 adds later — v7's upgrade ran
 * before those stores were physically created, and `clear()` threw.
 */
void describe('KlopitDB schema upgrade', () => {
  void it('opens without error when upgrading from a v6 database (no creditInterests yet)', async () => {
    const dbName = `klopit_upgrade_${String(Date.now())}_${Math.random().toString(36).slice(2)}`;

    // Seed a legacy database at the v6 schema (priorLosses added, no
    // creditInterests). This mirrors the state a user had before v7+
    // shipped. Only the minimum set of stores needed for the test —
    // anything missing would just be empty after the upgrade anyway.
    const legacy = new Dexie(dbName);
    legacy.version(1).stores({
      sessions: 'id, year',
      trades: '++id, sessionId, symbol, datetime',
      dividends: '++id, sessionId, symbol, date',
      corporateActions: '++id, sessionId, datetime',
      tradeResults: '++id, sessionId, symbol, datetime',
      dividendResults: '++id, sessionId, symbol, date',
      taxSummaries: 'sessionId',
      nbpRates: 'id, currency, date',
    });
    legacy.version(2).stores({
      withholdingTaxes: '++id, sessionId, symbol, date',
      carryInPositions: '++id, sessionId, symbol',
      transactionFees: '++id, sessionId, symbol, datetime',
    });
    legacy.version(3).stores({
      symbolCountryOverrides: '++id, sessionId, symbol',
    });
    legacy.version(4).stores({ sessions: 'id, year' });
    legacy.version(6).stores({
      priorLosses: '++id, sessionId, year, [sessionId+year]',
    });
    await legacy.open();
    await legacy.table('sessions').add({
      id: 'legacy-session',
      year: 2024,
      createdAt: new Date(),
      updatedAt: new Date(),
      files: [],
      status: 'draft',
    });
    legacy.close();

    // Re-open with the production `KlopitDB` class against the same DB
    // name. All upgrades (v7 wipe, v8 add credit-interest tables, v9
    // broker-id rename) must run without leaving the DB closed.
    const klopit = new KlopitDB(dbName);
    await klopit.open();
    const sessions = await klopit.sessions.toArray();
    // v7 wipes the DB, so the legacy session is gone — expected behaviour.
    assert.equal(sessions.length, 0);
    klopit.close();
  });

  void it('allows adding a session after upgrading from v6 (no DatabaseClosedError)', async () => {
    const dbName = `klopit_upgrade_${String(Date.now())}_${Math.random().toString(36).slice(2)}`;

    const legacy = new Dexie(dbName);
    legacy.version(1).stores({
      sessions: 'id, year',
      trades: '++id, sessionId, symbol, datetime',
      dividends: '++id, sessionId, symbol, date',
      corporateActions: '++id, sessionId, datetime',
      tradeResults: '++id, sessionId, symbol, datetime',
      dividendResults: '++id, sessionId, symbol, date',
      taxSummaries: 'sessionId',
      nbpRates: 'id, currency, date',
    });
    legacy.version(6).stores({
      priorLosses: '++id, sessionId, year, [sessionId+year]',
    });
    await legacy.open();
    legacy.close();

    const klopit = new KlopitDB(dbName);
    await klopit.open();
    await klopit.sessions.add({
      id: 'post-upgrade-session',
      year: 2025,
      createdAt: new Date(),
      updatedAt: new Date(),
      files: [],
      status: 'draft',
    });
    const rows = await klopit.sessions.toArray();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'post-upgrade-session');
    klopit.close();
  });
});
