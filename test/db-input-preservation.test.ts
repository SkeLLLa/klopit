import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Dexie } from 'dexie';

import { KlopitDB } from '../src/lib/db.js';

/**
 * Policy guard (see CONTRIBUTING.md, "Database schema upgrades"): an upgrade
 * must never clear or drop an INPUT table. DERIVED tables may be cleared, but
 * the affected sessions must then be reset to 'draft'.
 */
const INPUT = [
  'sessions',
  'trades',
  'dividends',
  'withholdingTaxes',
  'carryInPositions',
  'transactionFees',
  'creditInterests',
  'corporateActions',
  'priorLosses',
  'symbolCountryOverrides',
];
const DERIVED = [
  'tradeResults',
  'dividendResults',
  'creditInterestResults',
  'taxSummaries',
  'nbpRates',
];

const uniqueName = (): string =>
  `klopit_preserve_${String(Date.now())}_${Math.random().toString(36).slice(2)}`;

void describe('KlopitDB input-table preservation', () => {
  void it('classifies every table as INPUT or DERIVED', () => {
    const db = new KlopitDB(uniqueName());
    const actual = db.tables.map((t) => t.name).toSorted();
    const expected = [...INPUT, ...DERIVED].toSorted();
    assert.deepEqual(
      actual,
      expected,
      'New table detected: add it to INPUT or DERIVED in this test (and follow CONTRIBUTING.md upgrade policy).',
    );
  });

  void it('keeps every INPUT row when upgrading from v8 to the latest schema', async () => {
    const dbName = uniqueName();

    // Cumulative v1–v8 store definitions (same pattern as db-upgrade.test.ts).
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
    legacy.version(8).stores({
      creditInterests: '++id, sessionId, date',
      creditInterestResults: '++id, sessionId, date',
    });
    await legacy.open();

    // All INPUT tables exist at v8. Any INPUT table added after v8 is not
    // seeded here; it is covered by the table-classification test above and
    // should be added to a latest-version reseed when it is introduced.
    const sessionId = 'preserve-session';
    const now = new Date();
    const rows: Record<string, object> = {
      sessions: {
        id: sessionId,
        year: 2024,
        createdAt: now,
        updatedAt: now,
        files: [],
        status: 'calculated',
      },
      trades: { sessionId, symbol: 'AAPL', datetime: now },
      dividends: { sessionId, symbol: 'AAPL', date: now },
      withholdingTaxes: { sessionId, symbol: 'AAPL', date: now },
      carryInPositions: { sessionId, symbol: 'AAPL' },
      transactionFees: { sessionId, symbol: 'AAPL', datetime: now },
      creditInterests: { sessionId, date: now },
      corporateActions: { sessionId, datetime: now },
      priorLosses: { sessionId, year: 2022 },
      symbolCountryOverrides: { sessionId, symbol: 'AAPL' },
    };
    assert.deepEqual(Object.keys(rows).toSorted(), [...INPUT].toSorted());
    await Promise.all(
      Object.entries(rows).map(([table, row]) => legacy.table(table).add(row)),
    );
    legacy.close();

    const klopit = new KlopitDB(dbName);
    await klopit.open();
    try {
      const counts = await Promise.all(
        INPUT.map(async (table) => [table, await klopit.table(table).count()]),
      );
      for (const [table, count] of counts) {
        assert.equal(
          count,
          1,
          `upgrade lost rows from input table "${String(table)}"`,
        );
      }
    } finally {
      klopit.close();
    }
  });
});
