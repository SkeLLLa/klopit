import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { DERIVED_TABLES, INPUT_TABLES } from '../src/lib/db-tables.js';
import { KlopitDB } from '../src/lib/db.js';
import {
  BackupError,
  exportBackup,
  BACKUP_MAX_BYTES,
  BACKUP_MIGRATIONS,
  BACKUP_MIN_SCHEMA_VERSION,
  importBackup,
  parseBackup,
  readBackupFile,
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
      quantity: 1,
      price: 2,
      proceeds: 2,
      commission: 0,
      broker: 'ibkr',
      account: 'U123',
    },
    {
      sessionId,
      symbol: 'MSFT',
      datetime: d('2025-04-03T15:30:00Z'),
      quantity: 1,
      price: 2,
      proceeds: 2,
      commission: 0,
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
      amount: 5,
      account: 'U123',
    },
  ],
  withholdingTaxes: [
    { sessionId, symbol: 'AAPL', date: d('2025-05-01T00:00:00Z'), amount: -1 },
  ],
  carryInPositions: [
    {
      sessionId,
      symbol: 'KO',
      quantity: 3,
      year: 2024,
      acquisitionDate: d('2020-01-01T00:00:00Z'),
      account: 'U123',
    },
  ],
  transactionFees: [
    {
      sessionId,
      symbol: 'AAPL',
      datetime: d('2025-03-04T00:00:00Z'),
      amount: 1,
    },
  ],
  creditInterests: [{ sessionId, date: d('2025-06-01T00:00:00Z'), amount: 2 }],
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
  priorLosses: [
    { sessionId, year: 2023, totalLossPln: 100, alreadyDeductedPln: 0 },
  ],
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

const asObject = (v: unknown): object =>
  typeof v === 'object' && v !== null ? v : {};

async function importCode(text: string): Promise<string> {
  try {
    await importBackup({
      backup: parseBackup(text, database.verno),
      database,
    });
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
    await importBackup({ backup: parseBackup(text, database.verno), database });
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
    await importBackup({ backup: parseBackup(text, database.verno), database });
    assert.equal(
      await database.trades.where('symbol').equals('EXTRA').count(),
      0,
    );
  });

  void it('marks calculated sessions stale after import', async () => {
    await seed(database);
    const text = await exportBackup({ appVersion: 'x', database });
    await clearAll(database);
    await importBackup({ backup: parseBackup(text, database.verno), database });
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
        JSON.stringify({
          ...good,
          schemaVersion: BACKUP_MIN_SCHEMA_VERSION - 1,
        }),
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

  void it('rejects invalid rows', async () => {
    await seed(database);
    const good = JSON.parse(
      await exportBackup({ appVersion: 'x', database }),
    ) as BackupFile;
    const withTable = (name: string, rows: object[]): string =>
      JSON.stringify({ ...good, tables: { ...good.tables, [name]: rows } });
    const sessions = good.tables['sessions'] ?? [];
    const trades = good.tables['trades'] ?? [];
    const session = asObject(sessions[0]);
    const trade = asObject(trades[0]);

    assert.equal(
      await importCode(withTable('sessions', [{ ...session, id: 5 }])),
      'invalid',
      'session id must be a string',
    );
    assert.equal(
      await importCode(withTable('sessions', [session, session])),
      'invalid',
      'duplicate session ids',
    );
    assert.equal(
      await importCode(withTable('trades', [{ ...trade, sessionId: 'nope' }])),
      'invalid',
      'orphan child row',
    );
    assert.equal(
      await importCode(withTable('trades', [{ ...trade, quantity: 'x' }])),
      'invalid',
      'non-numeric quantity',
    );
    assert.equal(
      await importCode(withTable('trades', [{ ...trade, price: null }])),
      'invalid',
      'null price',
    );
    assert.equal(
      await importCode(
        withTable('trades', [{ ...trade, datetime: '2025-01-01' }]),
      ),
      'invalid',
      'untagged date',
    );
  });

  void it('rejects malformed $date tags and invalid dates', async () => {
    await seed(database);
    const text = await exportBackup({ appVersion: 'x', database });
    const iso = '2025-03-03T15:30:00.000Z';
    assert.ok(text.includes(iso));
    assert.equal(
      await importCode(
        text.replace(`{"$date":"${iso}"}`, '{"$date":"garbage"}'),
      ),
      'invalid',
    );
    assert.equal(
      await importCode(
        text.replace(
          `{"$date":"${iso}"}`,
          '{"$date":"2025-13-45T99:00:00.000Z"}',
        ),
      ),
      'invalid',
    );
    assert.equal(
      await importCode(text.replace(`{"$date":"${iso}"}`, '{"$date":null}')),
      'invalid',
    );
    assert.equal(
      await importCode(text.replace(`{"$date":"${iso}"}`, '{"$date":5}')),
      'invalid',
    );
    // Objects that merely contain a "$date" key next to others are left alone.
    assert.equal(
      JSON.stringify(
        parseBackup(
          text.replace(
            '"files":[]',
            '"files":[],"extra":{"$date":"x","other":1}',
          ),
          database.verno,
        ).tables['sessions']?.[1],
      ).includes('"other":1'),
      true,
    );
  });

  void it('refuses to export an invalid date', async () => {
    await seed(database);
    await database.table('trades').add({
      sessionId,
      symbol: 'BAD',
      datetime: new Date(NaN),
      quantity: 1,
      price: 1,
      proceeds: 1,
      commission: 0,
    });
    await assert.rejects(
      exportBackup({ appVersion: 'x', database }),
      BackupError,
    );
  });

  void it('rejects files over the size limit before reading them', async () => {
    const big = {
      size: BACKUP_MAX_BYTES + 1,
      text: () => Promise.reject(new Error('read')),
    };
    await assert.rejects(
      readBackupFile(big as unknown as Blob, database.verno),
      (e: unknown) => e instanceof BackupError && e.code === 'tooLarge',
    );
  });

  void it('has a backup migration for every version after the minimum', () => {
    for (let v = BACKUP_MIN_SCHEMA_VERSION + 1; v <= database.verno; v++) {
      assert.equal(
        typeof BACKUP_MIGRATIONS[v],
        'function',
        `database v${String(v)} needs a BACKUP_MIGRATIONS entry in src/lib/services/backup.ts (identity if row shapes are unchanged)`,
      );
    }
  });

  void it('migrates older supported backups up to the current version', () => {
    const migrations = BACKUP_MIGRATIONS as Record<number, unknown>;
    const next = database.verno + 1;
    migrations[next] = (t: Record<string, object[]>) => ({
      ...t,
      trades: (t['trades'] ?? []).map((r) => ({ ...r, migrated: true })),
    });
    try {
      const raw = {
        format: 'klopit-backup',
        formatVersion: 1,
        schemaVersion: database.verno,
        tables: Object.fromEntries(
          INPUT_TABLES.map((n) => [n, [] as object[]]),
        ),
      };
      const parsed = parseBackup(JSON.stringify(raw), next);
      assert.equal(parsed.schemaVersion, next);
      assert.equal(
        parseBackup(JSON.stringify({ ...raw, schemaVersion: next }), next)
          .schemaVersion,
        next,
      );
    } finally {
      delete migrations[next];
    }
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
