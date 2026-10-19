import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Dexie } from 'dexie';

import { DERIVED_TABLES, INPUT_TABLES } from '../src/lib/db-tables.js';
import { KlopitDB } from '../src/lib/db.js';
import { isSessionStale } from '../src/lib/utils/stale.js';

/**
 * Policy guard (see CONTRIBUTING.md, "Database Schema Upgrades"): an upgrade
 * must never clear or drop an INPUT table. DERIVED tables may be cleared, but
 * the affected sessions must then be reset to 'draft' or marked stale.
 */
const INPUT: readonly string[] = INPUT_TABLES;
const DERIVED: readonly string[] = DERIVED_TABLES;

const LATEST_VERSION = 17;

/** Cumulative store definitions of every shipped version, up to `upTo`. */
function declareVersions(db: Dexie, upTo: number): void {
  const versions: Record<number, Record<string, string>> = {
    1: {
      sessions: 'id, year',
      trades: '++id, sessionId, symbol, datetime',
      dividends: '++id, sessionId, symbol, date',
      corporateActions: '++id, sessionId, datetime',
      tradeResults: '++id, sessionId, symbol, datetime',
      dividendResults: '++id, sessionId, symbol, date',
      taxSummaries: 'sessionId',
      nbpRates: 'id, currency, date',
    },
    2: {
      withholdingTaxes: '++id, sessionId, symbol, date',
      carryInPositions: '++id, sessionId, symbol',
      transactionFees: '++id, sessionId, symbol, datetime',
    },
    3: { symbolCountryOverrides: '++id, sessionId, symbol' },
    4: { sessions: 'id, year' },
    6: { priorLosses: '++id, sessionId, year, [sessionId+year]' },
    8: {
      creditInterests: '++id, sessionId, date',
      creditInterestResults: '++id, sessionId, date',
    },
    10: {
      trades:
        '++id, sessionId, symbol, datetime, [sessionId+symbol], [sessionId+symbol+isin]',
      dividends:
        '++id, sessionId, symbol, date, [sessionId+symbol], [sessionId+symbol+isin]',
    },
    11: { sessions: 'id, year' },
  };
  for (let v = 1; v <= upTo; v++) db.version(v).stores(versions[v] ?? {});
}

function openLegacyAt(version: number, name: string): Dexie {
  const legacy = new Dexie(name);
  declareVersions(legacy, version);
  return legacy;
}

const uniqueName = (): string =>
  `klopit_preserve_${String(Date.now())}_${Math.random().toString(36).slice(2)}`;

/**
 * Seeds a database at `from`, upgrades it to the latest version, and checks
 * every INPUT row.
 */
async function checkStep(from: number): Promise<void> {
  const dbName = uniqueName();
  const legacy = openLegacyAt(from, dbName);
  await legacy.open();

  // All INPUT tables exist at v8. Rows are minimal on purpose: they only
  // have to survive the step.
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

  // The production class runs every upgrade after `from`, including the
  // `from` -> `from + 1` step; starting at each version covers each step's
  // upgrade function against realistic leftovers of the previous one.
  const klopit = new KlopitDB(dbName);
  await klopit.open();
  try {
    await Promise.all(
      INPUT.map(async (table) => {
        assert.equal(
          await klopit.table(table).count(),
          1,
          `upgrade from v${String(from)} lost rows from input table "${table}"`,
        );
      }),
    );
  } finally {
    klopit.close();
  }
}

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

  void it('keeps every INPUT row when upgrading from each version v8..v15 (every N-1 -> N step)', async () => {
    for (let from = 8; from < LATEST_VERSION; from++) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- steps share no state but run in order for readable failures
      await checkStep(from);
    }
  });

  void it('keeps realistic v15 rows through v16 and marks sessions stale', async () => {
    const dbName = uniqueName();
    const legacy = openLegacyAt(15, dbName);
    await legacy.open();
    const now = new Date('2024-06-01T00:00:00Z');
    const calculatedAt = new Date('2024-07-01T00:00:00Z');
    const account = 'ibkr:U1';
    const session = (id: string, status: string, files: object[]): object => ({
      id,
      year: 2024,
      createdAt: now,
      updatedAt: now,
      files,
      status,
      calculatedAt: status === 'calculated' ? calculatedAt : undefined,
      dataUpdatedAt: now,
    });
    const file = (broker: string): object => ({
      name: `${broker}.csv`,
      broker,
      size: 1,
      importedAt: now,
    });
    await legacy
      .table('sessions')
      .bulkAdd([
        session('single', 'calculated', [file('ibkr')]),
        session('multi', 'calculated', [file('ibkr'), file('schwab')]),
        session('accounts', 'calculated', []),
        session('draft', 'draft', [file('ibkr')]),
      ]);
    await legacy.table('trades').bulkAdd([
      {
        sessionId: 'single',
        symbol: 'AAPL',
        datetime: now,
        type: 'buy',
        account,
        incentive: { regime: 'art-11-4', taxedIncomePln: 100 },
      },
      {
        sessionId: 'accounts',
        symbol: 'AAPL',
        datetime: now,
        type: 'buy',
        account: 'ibkr:U1',
      },
      {
        sessionId: 'accounts',
        symbol: 'AAPL',
        datetime: now,
        type: 'buy',
        account: 'ibkr:U2',
      },
      { sessionId: 'multi', symbol: 'MSFT', datetime: now, type: 'sell' },
    ]);
    await legacy.table('corporateActions').add({
      sessionId: 'accounts',
      type: 'transfer',
      symbol: 'AAPL',
      datetime: now,
      numerator: 1,
      denominator: 1,
      fromAccount: 'ibkr:U1',
      toAccount: 'ibkr:U2',
      quantity: 5,
    });
    await legacy.table('carryInPositions').add({
      sessionId: 'accounts',
      symbol: 'AAPL',
      account: 'ibkr:U2',
      quantity: 3,
    });
    await legacy.table('symbolCountryOverrides').add({
      sessionId: 'single',
      symbol: 'AAPL',
      country: 'IE',
      scope: 'dividends',
    });
    await legacy
      .table('tradeResults')
      .add({ sessionId: 'single', symbol: 'AAPL', datetime: now });
    legacy.close();

    const klopit = new KlopitDB(dbName);
    await klopit.open();
    try {
      const trades = await klopit.trades.toArray();
      assert.equal(trades.length, 4);
      assert.deepEqual(
        trades.find((t) => t.sessionId === 'single')?.incentive,
        { regime: 'art-11-4', taxedIncomePln: 100 },
      );
      const [transfer] = await klopit.corporateActions.toArray();
      assert.ok(transfer);
      assert.equal(transfer.type, 'transfer');
      assert.equal(transfer.fromAccount, 'ibkr:U1');
      assert.equal(
        (await klopit.carryInPositions.toArray())[0]?.account,
        'ibkr:U2',
      );
      assert.equal(
        (await klopit.symbolCountryOverrides.toArray())[0]?.scope,
        'dividends',
      );
      // Derived rows are kept; staleness is what triggers the recalculation.
      assert.equal(await klopit.tradeResults.count(), 1);

      const byId = new Map(
        (await klopit.sessions.toArray()).map((s) => [s.id, s]),
      );
      for (const id of ['single', 'multi', 'accounts']) {
        const s = byId.get(id);
        assert.ok(s, id);
        assert.equal(
          isSessionStale({
            calculatedAt: s.calculatedAt,
            dataUpdatedAt: s.dataUpdatedAt,
          }),
          true,
          `${id} must be stale`,
        );
      }
      const draft = byId.get('draft');
      assert.ok(draft);
      assert.equal(
        isSessionStale({
          calculatedAt: draft.calculatedAt,
          dataUpdatedAt: draft.dataUpdatedAt,
        }),
        false,
      );
      assert.equal(draft.dataUpdatedAt?.getTime(), now.getTime());

      // One-time notice: only sessions mixing brokers / accounts.
      assert.equal(byId.get('single')?.perAccountFifoNoticePending, undefined);
      assert.equal(byId.get('draft')?.perAccountFifoNoticePending, undefined);
      assert.equal(byId.get('multi')?.perAccountFifoNoticePending, true);
      assert.equal(byId.get('accounts')?.perAccountFifoNoticePending, true);
    } finally {
      klopit.close();
    }
  });

  void it('does not flag sessions created after v16', async () => {
    const klopit = new KlopitDB(uniqueName());
    await klopit.open();
    try {
      await klopit.sessions.add({
        id: 'new',
        year: 2025,
        createdAt: new Date(),
        updatedAt: new Date(),
        files: [],
        status: 'draft',
      });
      assert.equal(
        (await klopit.sessions.get('new'))?.perAccountFifoNoticePending,
        undefined,
      );
    } finally {
      klopit.close();
    }
  });
});
