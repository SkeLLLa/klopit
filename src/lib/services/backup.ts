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

const DATE_TAG = '$date';

/** Dates are stored as `{"$date": "<ISO>"}` (or `null` for an invalid Date). */
function encodeDates(this: Record<string, unknown>, key: string, v: unknown) {
  const raw = this[key];
  if (raw instanceof Date) {
    return {
      [DATE_TAG]: Number.isNaN(raw.getTime()) ? null : raw.toISOString(),
    };
  }
  return v;
}

function reviveDates(_key: string, v: unknown): unknown {
  if (
    v !== null &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    DATE_TAG in v &&
    Object.keys(v).length === 1
  ) {
    const iso = (v as Record<string, unknown>)[DATE_TAG];
    if (iso === null) return new Date(NaN);
    if (typeof iso === 'string') return new Date(iso);
  }
  return v;
}

/** Serialize every input table (derived tables are recomputed on import). */
export async function exportBackup(
  args: { appVersion: string; database?: KlopitDB } = { appVersion: '' },
): Promise<string> {
  const database = args.database ?? db;
  const tables: Record<string, unknown[]> = {};
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

/** Parse and validate backup text without touching the database. */
export function parseBackup(text: string, schemaVersion: number): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text, reviveDates);
  } catch {
    throw new BackupError('corrupt', 'The file is not valid JSON.');
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- shape is validated below
  const file = data as Partial<BackupFile> | null;
  if (
    !file ||
    typeof file !== 'object' ||
    Array.isArray(file) ||
    file.format !== BACKUP_FORMAT
  ) {
    throw new BackupError('format', 'This is not a kloPIT backup file.');
  }
  if (file.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new BackupError(
      'formatVersion',
      `Unsupported backup format version: ${String(file.formatVersion)}.`,
    );
  }
  if (typeof file.schemaVersion !== 'number') {
    throw new BackupError('invalid', 'The backup has no database version.');
  }
  if (file.schemaVersion > schemaVersion) {
    throw new BackupError(
      'schemaNewer',
      `The backup comes from a newer version of kloPIT (database v${file.schemaVersion}, this app is v${schemaVersion}). Update the app and try again.`,
    );
  }
  if (file.schemaVersion < schemaVersion) {
    // Rows of older schemas would need the Dexie upgrade chain (v14/v16
    // rewrite rows). Replaying it in a temporary database needs every old
    // store definition kept in the app, so such backups are rejected instead.
    throw new BackupError(
      'schemaOlder',
      `The backup comes from an older version of kloPIT (database v${file.schemaVersion}, this app is v${schemaVersion}). Restore it in the version that created it.`,
    );
  }
  const tables = file.tables;
  if (!tables || typeof tables !== 'object' || Array.isArray(tables)) {
    throw new BackupError('invalid', 'The backup has no data tables.');
  }
  for (const name of INPUT_TABLES) {
    const rows = tables[name];
    if (
      !Array.isArray(rows) ||
      rows.some((r) => r === null || typeof r !== 'object' || Array.isArray(r))
    ) {
      throw new BackupError(
        'invalid',
        `The backup table "${name}" is invalid.`,
      );
    }
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- validated above
  return file as BackupFile;
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
  text: string;
  database?: KlopitDB;
}): Promise<void> {
  const database = args.database ?? db;
  const file = parseBackup(args.text, database.verno);
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
