import { typeid } from 'typeid-js';
import type { ImportWarning } from '../../core/types.js';
import { db, type ImportedFileRecord, type SessionRecord } from '../db.js';
import { mergeImportWarnings } from './import.js';

/** Create a new tax calculation session */
export async function createSession(args: {
  year: number;
}): Promise<SessionRecord> {
  const session: SessionRecord = {
    id: typeid('session').toString(),
    year: args.year,
    createdAt: new Date(),
    updatedAt: new Date(),
    files: [],
    status: 'draft',
  };
  await db.sessions.add(session);
  return session;
}

/** Get all sessions ordered by year descending */
export async function listSessions(): Promise<SessionRecord[]> {
  return db.sessions.orderBy('year').reverse().toArray();
}

/** Get a session by ID */
export async function getSession(args: {
  id: string;
}): Promise<SessionRecord | undefined> {
  return db.sessions.get(args.id);
}

/** Update session metadata */
export async function updateSession(args: {
  id: string;
  changes: Partial<
    Pick<
      SessionRecord,
      | 'residencyStartDate'
      | 'status'
      | 'oppKrs'
      | 'oppDetails'
      | 'oppConsent'
      | 'dataUpdatedAt'
      | 'calculatedAt'
    >
  >;
}): Promise<void> {
  await db.sessions.update(args.id, {
    ...args.changes,
    updatedAt: new Date(),
  });
}

/** Record an imported file in the session */
export async function addImportedFile(args: {
  sessionId: string;
  file: ImportedFileRecord;
}): Promise<void> {
  const session = await db.sessions.get(args.sessionId);
  if (!session) throw new Error(`Session not found: ${args.sessionId}`);
  await db.sessions.update(args.sessionId, {
    files: [...session.files, args.file],
    updatedAt: new Date(),
  });
}

/** Append import warnings to a session. */
export async function appendImportWarnings(args: {
  sessionId: string;
  warnings: ImportWarning[];
}): Promise<void> {
  if (args.warnings.length === 0) return;
  const session = await db.sessions.get(args.sessionId);
  if (!session) throw new Error(`Session not found: ${args.sessionId}`);
  await db.sessions.update(args.sessionId, {
    importWarnings: mergeImportWarnings({
      warnings: [...(session.importWarnings ?? []), ...args.warnings],
    }),
    updatedAt: new Date(),
  });
}

/** Delete a session and all associated data */
export async function deleteSession(args: { id: string }): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.sessions,
      db.trades,
      db.dividends,
      db.withholdingTaxes,
      db.carryInPositions,
      db.transactionFees,
      db.creditInterests,
      db.corporateActions,
      db.priorLosses,
      db.tradeResults,
      db.dividendResults,
      db.creditInterestResults,
      db.taxSummaries,
    ],
    async () => {
      await Promise.all([
        db.sessions.delete(args.id),
        db.trades.where('sessionId').equals(args.id).delete(),
        db.dividends.where('sessionId').equals(args.id).delete(),
        db.withholdingTaxes.where('sessionId').equals(args.id).delete(),
        db.carryInPositions.where('sessionId').equals(args.id).delete(),
        db.transactionFees.where('sessionId').equals(args.id).delete(),
        db.creditInterests.where('sessionId').equals(args.id).delete(),
        db.corporateActions.where('sessionId').equals(args.id).delete(),
        db.priorLosses.where('sessionId').equals(args.id).delete(),
        db.tradeResults.where('sessionId').equals(args.id).delete(),
        db.dividendResults.where('sessionId').equals(args.id).delete(),
        db.creditInterestResults.where('sessionId').equals(args.id).delete(),
        db.taxSummaries.delete(args.id),
      ]);
    },
  );
}
