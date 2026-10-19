import { DERIVED_TABLES, INPUT_TABLES } from '../db-tables.js';
import { db, type KlopitDB } from '../db.js';

export const BACKUP_FORMAT = 'klopit-backup';
export const BACKUP_FORMAT_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  schemaVersion: number;
  exportedAt: string;
  app: { version: string };
  tables: Record<string, unknown[]>;
}

export type BackupErrorCode =
  | 'corrupt'
  | 'format'
  | 'formatVersion'
  | 'schemaNewer'
  | 'schemaOlder'
  | 'tooLarge'
  | 'invalid';

/** Import failure with a stable code so the UI can show a localized message. */
export class BackupError extends Error {
  constructor(
    readonly code: BackupErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BackupError';
  }
}

/** Largest backup file the app will read. */
export const BACKUP_MAX_BYTES = 100 * 1024 * 1024;

/** Oldest database schema a backup can come from (backups start at v16). */
export const BACKUP_MIN_SCHEMA_VERSION = 16;

type BackupTables = Record<string, unknown[]>;

/**
 * Upgrades backup tables written at version N-1 to version N, keyed by the
 * target version N. Every database version bump must add an entry here (an
 * identity function when row shapes did not change), so older backups stay
 * restorable. `test/backup.test.ts` fails when an entry is missing.
 */
export const BACKUP_MIGRATIONS: Partial<
  Record<number, (tables: BackupTables) => BackupTables>
> = {};

const DATE_TAG = '$date';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

/** Dates are stored as `{"$date": "<ISO>"}`. */
function encodeDates(this: Record<string, unknown>, key: string, v: unknown) {
  const raw = this[key];
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) {
      throw new BackupError('invalid', `Field "${key}" holds an invalid date.`);
    }
    return { [DATE_TAG]: raw.toISOString() };
  }
  return v;
}

/** Revives single-key `$date` objects; a malformed one is an error. */
function reviveDates(_key: string, v: unknown): unknown {
  if (
    v !== null &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    DATE_TAG in v &&
    Object.keys(v).length === 1
  ) {
    const iso = (v as Record<string, unknown>)[DATE_TAG];
    if (typeof iso === 'string' && ISO_DATE.test(iso)) {
      const date = new Date(iso);
      if (!Number.isNaN(date.getTime())) return date;
    }
    throw new BackupError('invalid', 'The backup contains an invalid date.');
  }
  return v;
}

/** Serialize every input table (derived tables are recomputed on import). */
export async function exportBackup(args: {
  appVersion: string;
  database?: KlopitDB;
}): Promise<string> {
  const database = args.database ?? db;
  const tables: BackupTables = {};
  await database.transaction(
    'r',
    INPUT_TABLES.map((name) => database.table(name)),
    async () => {
      await Promise.all(
        INPUT_TABLES.map(async (name) => {
          tables[name] = await database.table(name).toArray();
        }),
      );
    },
  );
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: database.verno,
    exportedAt: new Date().toISOString(),
    app: { version: args.appVersion },
    tables,
  };
  return JSON.stringify(file, encodeDates);
}

/** Required (`req`) and optional (`opt`) Date / number fields per table. */
interface RowSpec {
  dates?: { req?: string[]; opt?: string[] };
  numbers?: { req?: string[]; opt?: string[] };
}

const ROW_SPECS: Record<(typeof INPUT_TABLES)[number], RowSpec> = {
  sessions: {
    dates: {
      req: ['createdAt', 'updatedAt'],
      opt: ['residencyStartDate', 'dataUpdatedAt', 'calculatedAt'],
    },
    numbers: { req: ['year'] },
  },
  trades: {
    dates: { req: ['datetime'] },
    numbers: { req: ['quantity', 'price', 'proceeds', 'commission'] },
  },
  dividends: { dates: { req: ['date'] }, numbers: { req: ['amount'] } },
  withholdingTaxes: { dates: { req: ['date'] }, numbers: { req: ['amount'] } },
  carryInPositions: {
    dates: { opt: ['acquisitionDate'] },
    numbers: { req: ['quantity', 'year'], opt: ['costBasis', 'costBasisPln'] },
  },
  transactionFees: {
    dates: { req: ['datetime'] },
    numbers: { req: ['amount'] },
  },
  creditInterests: { dates: { req: ['date'] }, numbers: { req: ['amount'] } },
  corporateActions: { dates: { req: ['datetime'] } },
  priorLosses: {
    numbers: { req: ['year', 'totalLossPln', 'alreadyDeductedPln'] },
  },
  symbolCountryOverrides: {},
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

const isFiniteNumber = (v: unknown): boolean =>
  typeof v === 'number' && Number.isFinite(v);
const isDate = (v: unknown): boolean =>
  v instanceof Date && !Number.isNaN(v.getTime());

function checkFields(
  table: string,
  row: Record<string, unknown>,
  fields: { req?: string[]; opt?: string[] } | undefined,
  ok: (v: unknown) => boolean,
  kind: string,
): void {
  for (const field of fields?.req ?? []) {
    if (!ok(row[field])) {
      throw new BackupError(
        'invalid',
        `Table "${table}": field "${field}" must be a valid ${kind}.`,
      );
    }
  }
  for (const field of fields?.opt ?? []) {
    if (row[field] !== undefined && !ok(row[field])) {
      throw new BackupError(
        'invalid',
        `Table "${table}": field "${field}" must be a valid ${kind}.`,
      );
    }
  }
}

function validateRows(tables: BackupTables): void {
  const sessionIds = new Set<string>();
  for (const name of INPUT_TABLES) {
    const rows = tables[name];
    if (!Array.isArray(rows)) {
      throw new BackupError(
        'invalid',
        `The backup table "${name}" is missing.`,
      );
    }
    for (const row of rows) {
      if (!isRecord(row)) {
        throw new BackupError(
          'invalid',
          `The backup table "${name}" is invalid.`,
        );
      }
      const spec = ROW_SPECS[name];
      checkFields(name, row, spec.dates, isDate, 'date');
      checkFields(name, row, spec.numbers, isFiniteNumber, 'number');
      if (name === 'sessions') {
        if (typeof row['id'] !== 'string' || row['id'] === '') {
          throw new BackupError('invalid', 'A session has no string id.');
        }
        if (sessionIds.has(row['id'])) {
          throw new BackupError(
            'invalid',
            `Duplicate session id "${row['id']}".`,
          );
        }
        sessionIds.add(row['id']);
      }
    }
  }
  for (const name of INPUT_TABLES) {
    if (name === 'sessions') continue;
    for (const row of tables[name] ?? []) {
      const owner = isRecord(row) ? row['sessionId'] : undefined;
      if (typeof owner !== 'string' || !sessionIds.has(owner)) {
        throw new BackupError(
          'invalid',
          `Table "${name}": a row references a session that is not in the backup.`,
        );
      }
    }
  }
}

/**
 * Parse and validate backup text without touching the database. Backups from
 * older (supported) schemas are migrated to `schemaVersion`.
 */
export function parseBackup(text: string, schemaVersion: number): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text, reviveDates);
  } catch (e) {
    if (e instanceof BackupError) throw e;
    throw new BackupError('corrupt', 'The file is not valid JSON.');
  }
  if (!isRecord(data) || data['format'] !== BACKUP_FORMAT) {
    throw new BackupError('format', 'This is not a kloPIT backup file.');
  }
  if (data['formatVersion'] !== BACKUP_FORMAT_VERSION) {
    throw new BackupError(
      'formatVersion',
      `Unsupported backup format version: ${String(data['formatVersion'])}.`,
    );
  }
  const fileVersion = data['schemaVersion'];
  if (typeof fileVersion !== 'number' || !Number.isInteger(fileVersion)) {
    throw new BackupError('invalid', 'The backup has no database version.');
  }
  if (fileVersion > schemaVersion) {
    throw new BackupError(
      'schemaNewer',
      `The backup comes from a newer version of kloPIT (database v${fileVersion}, this app is v${schemaVersion}). Update the app and try again.`,
    );
  }
  if (fileVersion < BACKUP_MIN_SCHEMA_VERSION) {
    throw new BackupError(
      'schemaOlder',
      `The backup comes from a version of kloPIT that is too old (database v${fileVersion}, oldest supported is v${BACKUP_MIN_SCHEMA_VERSION}).`,
    );
  }
  const raw = data['tables'];
  if (!isRecord(raw)) {
    throw new BackupError('invalid', 'The backup has no data tables.');
  }
  let tables: BackupTables = {};
  for (const name of INPUT_TABLES) {
    const rows = raw[name];
    if (!Array.isArray(rows)) {
      throw new BackupError(
        'invalid',
        `The backup table "${name}" is invalid.`,
      );
    }
    tables[name] = rows;
  }
  for (let v = fileVersion + 1; v <= schemaVersion; v++) {
    const migrate = BACKUP_MIGRATIONS[v];
    if (!migrate) {
      throw new BackupError(
        'schemaOlder',
        `No backup migration to database v${v}.`,
      );
    }
    tables = migrate(tables);
  }
  validateRows(tables);
  const exportedAt = data['exportedAt'];
  const app = data['app'];
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion,
    exportedAt: typeof exportedAt === 'string' ? exportedAt : '',
    app: {
      version:
        isRecord(app) && typeof app['version'] === 'string'
          ? app['version']
          : '',
    },
    tables,
  };
}

/** Read, size-check, parse and validate a user-selected backup file. */
export async function readBackupFile(
  file: Blob,
  schemaVersion: number = db.verno,
): Promise<BackupFile> {
  if (file.size > BACKUP_MAX_BYTES) {
    throw new BackupError('tooLarge', 'The backup file is too large.');
  }
  return parseBackup(await file.text(), schemaVersion);
}

/** Bumps `dataUpdatedAt` of a calculated session past `calculatedAt`. */
function markStale(row: unknown, now: number): unknown {
  if (row === null || typeof row !== 'object' || !('status' in row)) return row;
  if (row.status !== 'calculated') return row;
  const calculatedAt =
    'calculatedAt' in row && row.calculatedAt instanceof Date
      ? row.calculatedAt.getTime()
      : 0;
  return { ...row, dataUpdatedAt: new Date(Math.max(now, calculatedAt) + 1) };
}

/**
 * Replace all local data with the backup. Input and derived tables are cleared
 * and rewritten in one transaction. Calculated sessions keep `calculatedAt` and
 * get `dataUpdatedAt` bumped (as in the v15/v16 upgrades), so they show as
 * stale and the user recalculates.
 */
export async function importBackup(args: {
  backup: BackupFile;
  database?: KlopitDB;
}): Promise<void> {
  const database = args.database ?? db;
  const file = args.backup;
  const names = [...INPUT_TABLES, ...DERIVED_TABLES];
  const now = Date.now();
  await database.transaction(
    'rw',
    names.map((name) => database.table(name)),
    async () => {
      await Promise.all(names.map((name) => database.table(name).clear()));
      await Promise.all(
        INPUT_TABLES.map((name) => {
          const rows = file.tables[name] ?? [];
          return database
            .table(name)
            .bulkAdd(
              name === 'sessions'
                ? rows.map((row) => markStale(row, now))
                : rows,
            );
        }),
      );
    },
  );
}
