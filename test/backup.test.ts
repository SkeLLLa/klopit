import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { DERIVED_TABLES, INPUT_TABLES } from '../src/lib/db-tables.js';
import { KlopitDB } from '../src/lib/db.js';
import {
  BackupError,
  exportBackup,
  importBackup,
  type BackupFile,
} from '../src/lib/services/backup.js';
import { isSessionStale } from '../src/lib/utils/stale.js';

let dbCounter = 0;
let database: KlopitDB;

beforeEach(() => {
  dbCounter += 1;
  database = new KlopitDB(`klopit_backup_${String(dbCounter)}`);
});

const d = (iso: string): Date => new Date(iso);
const sessionId = 's1';

/** One or more rows for every input table; some carry account fields. */
const SEED: Record<(typeof INPUT_TABLES)[number], object[]> = {
  sessions: [
    {
      id: 's1',
      year: 2025,
      createdAt: d('2025-01-01T10:00:00Z'),
      updatedAt: d('2025-02-01T10:00:00Z'),
      files: [
        {
          name: 'a.csv',
          broker: 'ibkr',
          size: 12,
          importedAt: d('2025-01-02T00:00:00Z'),
        },
      ],
      residencyStartDate: d('2025-03-01T00:00:00Z'),
      status: 'calculated',
      calculatedAt: d('2025-02-02T00:00:00Z'),
      dataUpdatedAt: d('2025-02-01T00:00:00Z'),
    },
    {
      id: 's2',
      year: 2024,
      createdAt: d('2024-01-01T10:00:00Z'),
      updatedAt: d('2024-01-01T10:00:00Z'),
      files: [],
      status: 'draft',
    },
  ],
  trades: [
    {
      sessionId,
      symbol: 'AAPL',
      datetime: d('2025-03-03T15:30:00Z'),
      broker: 'ibkr',
      account: 'U123',
    },
    {
      sessionId,
      symbol: 'MSFT',
      datetime: d('2025-04-03T15:30:00Z'),
      broker: 'schwab',
      account: '__unassigned__',
    },
  ],
  dividends: [
    {
      sessionId,
      symbol: 'AAPL',
      date: d('2025-05-01T00:00:00Z'),
      withholdingTax: 1,
      account: 'U123',
    },
  ],
  withholdingTaxes: [
    { sessionId, symbol: 'AAPL', date: d('2025-05-01T00:00:00Z') },
  ],
  carryInPositions: [
    {
      sessionId,
      symbol: 'KO',
      acquisitionDate: d('2020-01-01T00:00:00Z'),
      account: 'U123',
    },
  ],
  transactionFees: [
    { sessionId, symbol: 'AAPL', datetime: d('2025-03-04T00:00:00Z') },
  ],
  creditInterests: [{ sessionId, date: d('2025-06-01T00:00:00Z') }],
  corporateActions: [
    {
      sessionId,
      type: 'transfer',
      symbol: 'AAPL',
      datetime: d('2025-07-01T09:00:00Z'),
      account: 'U123',
      toAccount: 'U456',
      manual: true,
    },
  ],
  priorLosses: [{ sessionId, year: 2023, amount: 100 }],
  symbolCountryOverrides: [
    { sessionId, symbol: 'AAPL', country: 'US', scope: 'gains' },
  ],
};

async function seed(db: KlopitDB): Promise<void> {
  for (const name of INPUT_TABLES) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- sequential seeding keeps ids deterministic
    await db.table(name).bulkAdd(SEED[name]);
  }
  await db.table('tradeResults').add({ sessionId, symbol: 'AAPL' });
  await db.table('nbpRates').add({
    id: 'USD:2025-01-02',
    currency: 'USD',
    date: '2025-01-02',
    rate: 4,
    table: 'a',
  });
}

async function dump(db: KlopitDB): Promise<Record<string, object[]>> {
  const out: Record<string, object[]> = {};
  for (const name of INPUT_TABLES) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- tables are dumped in a fixed order
    const rows = await db.table<object>(name).toArray();
    // The stale bump (and the Dexie hooks) legitimately change dataUpdatedAt.
    out[name] =
      name === 'sessions'
        ? rows.map((row) => {
            const copy: Record<string, unknown> = { ...row };
            delete copy['dataUpdatedAt'];
            return copy;
          })
        : rows;
  }
  return out;
}

async function clearAll(db: KlopitDB): Promise<void> {
  await Promise.all(
    [...INPUT_TABLES, ...DERIVED_TABLES].map((name) => db.table(name).clear()),
  );
}

async function importCode(text: string): Promise<string> {
  try {
    await importBackup({ text, database });
  } catch (e) {
    assert.ok(e instanceof BackupError);
    return e.code;
  }
  return 'accepted';
}

void describe('backup export / import', () => {
  void it('round-trips every input table including Date instances', async () => {
    await seed(database);
    const before = await dump(database);
    for (const name of INPUT_TABLES) {
      assert.ok(before[name].length > 0, `${name} seeded`);
    }
    const text = await exportBackup({ appVersion: '1.2.3', database });
    const parsed = JSON.parse(text) as BackupFile;
    assert.equal(parsed.format, 'klopit-backup');
    assert.equal(parsed.formatVersion, 1);
    assert.equal(parsed.schemaVersion, database.verno);
    assert.equal(parsed.app.version, '1.2.3');
    assert.deepEqual(
      Object.keys(parsed.tables).toSorted(),
      [...INPUT_TABLES].toSorted(),
    );

    await clearAll(database);
    await importBackup({ text, database });
    assert.deepStrictEqual(await dump(database), before);
    const [trade] = await database.trades.toArray();
    assert.ok(trade.datetime instanceof Date);
    assert.equal(await database.tradeResults.count(), 0);
    assert.equal(await database.nbpRates.count(), 0);
  });

  void it('replaces existing data on import', async () => {
    await seed(database);
    const text = await exportBackup({ appVersion: 'x', database });
    await database.table('trades').add({ sessionId, symbol: 'EXTRA' });
    await importBackup({ text, database });
    assert.equal(
      await database.trades.where('symbol').equals('EXTRA').count(),
      0,
    );
  });

  void it('marks calculated sessions stale after import', async () => {
    await seed(database);
    const text = await exportBackup({ appVersion: 'x', database });
    await clearAll(database);
    await importBackup({ text, database });
    const session = await database.sessions.get('s1');
    assert.ok(session);
    assert.ok(
      isSessionStale({
        calculatedAt: session.calculatedAt,
        dataUpdatedAt: session.dataUpdatedAt,
      }),
    );
  });

  void it('rejects wrong format, newer or older schema and corrupt JSON', async () => {
    await seed(database);
    const good = JSON.parse(
      await exportBackup({ appVersion: 'x', database }),
    ) as BackupFile;
    assert.equal(await importCode('{not json'), 'corrupt');
    assert.equal(await importCode('[]'), 'format');
    assert.equal(
      await importCode(JSON.stringify({ ...good, format: 'other' })),
      'format',
    );
    assert.equal(
      await importCode(JSON.stringify({ ...good, formatVersion: 2 })),
      'formatVersion',
    );
    assert.equal(
      await importCode(
        JSON.stringify({ ...good, schemaVersion: database.verno + 1 }),
      ),
      'schemaNewer',
    );
    assert.equal(
      await importCode(
        JSON.stringify({ ...good, schemaVersion: database.verno - 1 }),
      ),
      'schemaOlder',
    );
    assert.equal(
      await importCode(
        JSON.stringify({ ...good, tables: { ...good.tables, trades: 'nope' } }),
      ),
      'invalid',
    );
    // Rejected imports leave existing data untouched.
    assert.equal(await database.trades.count(), 2);
  });

  void it('classifies every table of db.ts as input or derived', () => {
    const declared = database.tables.map((t) => t.name).toSorted();
    const classified = [...INPUT_TABLES, ...DERIVED_TABLES].toSorted();
    assert.deepEqual(
      declared,
      classified,
      'New table detected: add it to INPUT_TABLES or DERIVED_TABLES in db-tables.ts (backup export/import depends on it).',
    );
  });
});
