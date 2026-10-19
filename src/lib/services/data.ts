import { dividendMatchKey } from '../../core/tax/dividends.js';
import type {
  CarryInPosition,
  CorporateAction,
  PriorYearLoss,
  RawCreditInterest,
  RawDividend,
  RawWithholdingTax,
  Trade,
} from '../../core/types.js';
import { db, type WithholdingTaxRecord } from '../db.js';
import { normalizeCarryInPosition } from './carry-in.js';
import {
  resolveDividendCountry,
  setSymbolCountryOverride,
} from './country-overrides.js';

// --- Trades (full CRUD) ---

export async function addTrade(args: {
  sessionId: string;
  trade: Trade;
}): Promise<number> {
  const id = await db.trades.add({ ...args.trade, sessionId: args.sessionId });
  if (id === undefined) throw new Error('Failed to insert trade');
  return id;
}

export async function updateTrade(args: {
  id: number;
  changes: Partial<Trade>;
}): Promise<void> {
  await db.trades.update(args.id, args.changes);
}

export async function deleteTrade(args: { id: number }): Promise<void> {
  await db.trades.delete(args.id);
}

// --- Dividends (full CRUD, with an optional linked withholding row) ---

export type ManualEntryValidationCode =
  | 'withholding-negative'
  | 'withholding-exceeds-gross'
  | 'withholding-not-finite'
  | 'linked-key-change'
  | 'linked-amount-sign'
  | 'amount-invalid'
  | 'symbol-required'
  | 'currency-required'
  | 'date-invalid';

export class ManualEntryValidationError extends Error {
  readonly code: ManualEntryValidationCode;
  constructor(code: ManualEntryValidationCode) {
    super(`Invalid manual entry: ${code}`);
    this.name = 'ManualEntryValidationError';
    this.code = code;
  }
}

function checkWithholding(withholding: number, gross: number): void {
  if (!Number.isFinite(withholding)) {
    throw new ManualEntryValidationError('withholding-not-finite');
  }
  if (withholding < 0) {
    throw new ManualEntryValidationError('withholding-negative');
  }
  if (withholding > gross) {
    throw new ManualEntryValidationError('withholding-exceeds-gross');
  }
}

const rowIds = (rows: { id?: number | undefined }[]): number[] =>
  rows.flatMap((r) => (r.id === undefined ? [] : [r.id]));

/** A complete, valid dividend for adding (throws ManualEntryValidationError). */
function validNewDividend(d: Partial<RawDividend>): RawDividend {
  if (!d.symbol?.trim()) {
    throw new ManualEntryValidationError('symbol-required');
  }
  if (!d.currency?.trim()) {
    throw new ManualEntryValidationError('currency-required');
  }
  if (!(d.date instanceof Date) || Number.isNaN(d.date.getTime())) {
    throw new ManualEntryValidationError('date-invalid');
  }
  if (d.amount === undefined || !Number.isFinite(d.amount) || d.amount <= 0) {
    throw new ManualEntryValidationError('amount-invalid');
  }
  return {
    ...d,
    symbol: d.symbol,
    currency: d.currency,
    date: d.date,
    amount: d.amount,
  };
}

async function linkedWithholdingRows(
  sessionId: string,
  dividendId: number,
): Promise<WithholdingTaxRecord[]> {
  return db.withholdingTaxes
    .where('sessionId')
    .equals(sessionId)
    .filter((r) => r.dividendId === dividendId)
    .toArray();
}

/**
 * Adds or updates a dividend and keeps its linked withholding row in sync, in
 * one transaction. `withholding` is the positive tax withheld: `undefined`
 * leaves linked rows alone (key fields are still synced), `0` deletes them.
 * `country` is written as a dividend-scope override only when the symbol's
 * country cannot be derived and the symbol has no override.
 */
export async function saveDividend(args: {
  sessionId: string;
  id?: number | undefined;
  /** Full row when adding; partial changes when updating. */
  dividend: Partial<RawDividend>;
  withholding?: number | undefined;
  country?: string | undefined;
}): Promise<number> {
  const { sessionId, withholding } = args;
  return db.transaction(
    'rw',
    [
      db.dividends,
      db.withholdingTaxes,
      db.symbolCountryOverrides,
      db.trades,
      db.sessions,
    ],
    async () => {
      let id: number;
      const created =
        args.id === undefined ? validNewDividend(args.dividend) : undefined;
      const gross =
        args.dividend.amount ??
        (args.id === undefined
          ? undefined
          : (await db.dividends.get(args.id))?.amount);
      if (withholding !== undefined && gross !== undefined) {
        checkWithholding(withholding, gross);
      }

      if (args.id === undefined) {
        const added = await db.dividends.add({
          ...(created ?? validNewDividend(args.dividend)),
          sessionId,
          withholdingTax: 0,
        });
        if (added === undefined) throw new Error('Failed to insert dividend');
        id = added;
      } else {
        id = args.id;
        const updated = await db.dividends.update(id, args.dividend);
        if (updated === 0) throw new Error('Dividend not found');
      }
      const stored = await db.dividends.get(id);
      if (!stored) throw new Error('Failed to insert dividend');

      const linked = await linkedWithholdingRows(sessionId, id);
      const key = {
        symbol: stored.symbol,
        isin: stored.isin,
        currency: stored.currency,
        date: stored.date,
        kind: stored.kind,
      };
      if (withholding === undefined || withholding > 0) {
        // Keep the first linked row, drop duplicates.
        const first = linked.at(0);
        const rest = linked.slice(1);
        if (rest.length > 0) {
          await db.withholdingTaxes.bulkDelete(rowIds(rest));
        }
        if (first?.id !== undefined) {
          const amount =
            withholding === undefined ? first.amount : -withholding;
          if (amount >= 0) {
            throw new ManualEntryValidationError('linked-amount-sign');
          }
          if (-amount > stored.amount) {
            throw new ManualEntryValidationError('withholding-exceeds-gross');
          }
          await db.withholdingTaxes.update(first.id, {
            ...key,
            amount,
          });
        } else if (withholding !== undefined) {
          await db.withholdingTaxes.add({
            ...key,
            sessionId,
            amount: -withholding,
            dividendId: id,
          });
        }
      } else if (linked.length > 0) {
        await db.withholdingTaxes.bulkDelete(rowIds(linked));
      }

      const country = args.country?.trim().toUpperCase();
      if (country) {
        const info = await resolveDividendCountry({
          sessionId,
          symbol: stored.symbol,
          isin: stored.isin,
        });
        if (info.source === 'unknown' && info.overrideScope === undefined) {
          await setSymbolCountryOverride({
            sessionId,
            symbol: stored.symbol,
            country,
            scope: 'dividends',
          });
        }
      }
      return id;
    },
  );
}

export async function addDividend(args: {
  sessionId: string;
  dividend: RawDividend;
}): Promise<number> {
  return saveDividend({ sessionId: args.sessionId, dividend: args.dividend });
}

export async function updateDividend(args: {
  id: number;
  changes: Partial<RawDividend>;
}): Promise<void> {
  const row = await db.dividends.get(args.id);
  if (!row) return;
  await saveDividend({
    sessionId: row.sessionId,
    id: args.id,
    dividend: args.changes,
  });
}

export async function deleteDividend(args: { id: number }): Promise<void> {
  await db.transaction('rw', [db.dividends, db.withholdingTaxes], async () => {
    const row = await db.dividends.get(args.id);
    if (row) {
      const linked = await linkedWithholdingRows(row.sessionId, args.id);
      await db.withholdingTaxes.bulkDelete(rowIds(linked));
    }
    await db.dividends.delete(args.id);
  });
}

// --- Withholding Taxes (add, edit, delete) ---

/** Free-standing withholding row (withheld: amount < 0, refund: amount > 0). */
export async function addWithholdingTax(args: {
  sessionId: string;
  withholding: RawWithholdingTax;
}): Promise<number> {
  const w = args.withholding;
  if (!Number.isFinite(w.amount) || w.amount === 0) {
    throw new ManualEntryValidationError('amount-invalid');
  }
  if (!w.symbol.trim()) {
    throw new ManualEntryValidationError('symbol-required');
  }
  if (!w.currency.trim()) {
    throw new ManualEntryValidationError('currency-required');
  }
  if (!(w.date instanceof Date) || Number.isNaN(w.date.getTime())) {
    throw new ManualEntryValidationError('date-invalid');
  }
  const id = await db.withholdingTaxes.add({
    ...w,
    symbol: w.symbol.trim().toUpperCase(),
    currency: w.currency.trim().toUpperCase(),
    sessionId: args.sessionId,
  });
  if (id === undefined) throw new Error('Failed to insert withholding tax');
  return id;
}

const LINKED_KEY_FIELDS = [
  'symbol',
  'isin',
  'date',
  'currency',
  'kind',
] as const;

export async function updateWithholdingTax(args: {
  id: number;
  changes: Partial<RawWithholdingTax>;
}): Promise<void> {
  await db.transaction('rw', [db.dividends, db.withholdingTaxes], async () => {
    const row = await db.withholdingTaxes.get(args.id);
    if (row?.dividendId !== undefined) {
      for (const field of LINKED_KEY_FIELDS) {
        if (!(field in args.changes)) continue;
        const next = args.changes[field];
        const current = row[field];
        const same =
          next instanceof Date && current instanceof Date
            ? next.getTime() === current.getTime()
            : next === current;
        if (!same) throw new ManualEntryValidationError('linked-key-change');
      }
      const amount = args.changes.amount;
      if (amount !== undefined) {
        if (!Number.isFinite(amount) || amount >= 0) {
          throw new ManualEntryValidationError('linked-amount-sign');
        }
        const dividend = await db.dividends.get(row.dividendId);
        if (dividend && -amount > dividend.amount) {
          throw new ManualEntryValidationError('withholding-exceeds-gross');
        }
      }
    }
    await db.withholdingTaxes.update(args.id, args.changes);
  });
}

export async function deleteWithholdingTax(args: {
  id: number;
}): Promise<void> {
  await db.withholdingTaxes.delete(args.id);
}

/**
 * For the dividend table and form: the linked withholding row per dividend, and
 * the match keys of imported/free-standing (unlinked) withholding rows.
 */
export async function listDividendWithholding(args: {
  sessionId: string;
}): Promise<{
  linkedByDividendId: Map<number, WithholdingTaxRecord>;
  unlinkedKeys: Set<string>;
}> {
  const rows = await db.withholdingTaxes
    .where('sessionId')
    .equals(args.sessionId)
    .toArray();
  const linkedByDividendId = new Map<number, WithholdingTaxRecord>();
  const unlinkedKeys = new Set<string>();
  for (const row of rows) {
    if (row.dividendId !== undefined) {
      if (!linkedByDividendId.has(row.dividendId)) {
        linkedByDividendId.set(row.dividendId, row);
      }
    } else {
      unlinkedKeys.add(dividendMatchKey(row));
    }
  }
  return { linkedByDividendId, unlinkedKeys };
}

// --- Corporate Actions (add transfer, edit/delete) ---

/**
 * Manual transfer of shares between two accounts (not a sale; lots keep their
 * cost and purchase date). Stored as a corporate action, so it is kept like the
 * other rows of that table.
 */
export async function addTransfer(args: {
  sessionId: string;
  transfer: CorporateAction;
}): Promise<number> {
  const id = await db.corporateActions.add({
    ...args.transfer,
    type: 'transfer',
    sessionId: args.sessionId,
  });
  if (id === undefined) throw new Error('Failed to insert transfer');
  return id;
}

export async function updateCorporateAction(args: {
  id: number;
  changes: Partial<CorporateAction>;
}): Promise<void> {
  await db.corporateActions.update(args.id, args.changes);
}

export async function deleteCorporateAction(args: {
  id: number;
}): Promise<void> {
  await db.corporateActions.delete(args.id);
}

// --- Carry-in Positions (full CRUD) ---

async function sessionYear(sessionId: string): Promise<number | undefined> {
  return (await db.sessions.get(sessionId))?.year;
}

/**
 * Validates via {@link normalizeCarryInPosition} (throws
 * CarryInValidationError).
 */
export async function addCarryInPosition(args: {
  sessionId: string;
  position: CarryInPosition;
}): Promise<number> {
  const position = normalizeCarryInPosition(args.position, {
    sessionYear: await sessionYear(args.sessionId),
  });
  const id = await db.carryInPositions.add({
    ...position,
    sessionId: args.sessionId,
  });
  if (id === undefined) throw new Error('Failed to insert carry-in position');
  return id;
}

/**
 * Merge `changes` into the stored row and validate the result as a whole, so
 * cross-field rules (currency / acquisition date / year) always hold.
 */
export async function updateCarryInPosition(args: {
  id: number;
  changes: Partial<CarryInPosition>;
}): Promise<void> {
  const existing = await db.carryInPositions.get(args.id);
  if (!existing)
    throw new Error(`Carry-in position ${String(args.id)} not found`);
  const merged = { ...existing, ...args.changes };
  // A PLN override would silently hide an edited cost or currency: drop it
  // unless the change sets it too.
  const { changes } = args;
  const costEdited =
    ('costBasis' in changes && changes.costBasis !== existing.costBasis) ||
    ('currency' in changes &&
      (changes.currency ?? 'PLN') !== (existing.currency ?? 'PLN'));
  if (costEdited && !('costBasisPln' in changes)) delete merged.costBasisPln;
  await db.carryInPositions.put(
    normalizeCarryInPosition(merged, {
      sessionYear: await sessionYear(existing.sessionId),
    }),
  );
}

export async function deleteCarryInPosition(args: {
  id: number;
}): Promise<void> {
  await db.carryInPositions.delete(args.id);
}

// --- Credit Interest (edit/delete) ---

export async function updateCreditInterest(args: {
  id: number;
  changes: Partial<RawCreditInterest>;
}): Promise<void> {
  await db.creditInterests.update(args.id, args.changes);
}

export async function deleteCreditInterest(args: {
  id: number;
}): Promise<void> {
  await db.creditInterests.delete(args.id);
}

// --- Prior-Year Losses (full CRUD) ---

export async function addPriorYearLoss(args: {
  sessionId: string;
  loss: PriorYearLoss;
}): Promise<number> {
  const id = await db.priorLosses.add({
    ...args.loss,
    sessionId: args.sessionId,
  });
  if (id === undefined) throw new Error('Failed to insert prior-year loss');
  return id;
}

export async function updatePriorYearLoss(args: {
  id: number;
  changes: Partial<PriorYearLoss>;
}): Promise<void> {
  await db.priorLosses.update(args.id, args.changes);
}

export async function deletePriorYearLoss(args: { id: number }): Promise<void> {
  await db.priorLosses.delete(args.id);
}
