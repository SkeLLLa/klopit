import type {
  CarryInPosition,
  CorporateAction,
  PriorYearLoss,
  RawCreditInterest,
  RawDividend,
  RawWithholdingTax,
  Trade,
} from '../../core/types.js';
import { db } from '../db.js';

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

// --- Dividends (full CRUD) ---

export async function addDividend(args: {
  sessionId: string;
  dividend: RawDividend;
}): Promise<number> {
  const id = await db.dividends.add({
    ...args.dividend,
    sessionId: args.sessionId,
    withholdingTax: 0,
  });
  if (id === undefined) throw new Error('Failed to insert dividend');
  return id;
}

export async function updateDividend(args: {
  id: number;
  changes: Partial<RawDividend>;
}): Promise<void> {
  await db.dividends.update(args.id, args.changes);
}

export async function deleteDividend(args: { id: number }): Promise<void> {
  await db.dividends.delete(args.id);
}

// --- Withholding Taxes (edit/delete) ---

export async function updateWithholdingTax(args: {
  id: number;
  changes: Partial<RawWithholdingTax>;
}): Promise<void> {
  await db.withholdingTaxes.update(args.id, args.changes);
}

export async function deleteWithholdingTax(args: {
  id: number;
}): Promise<void> {
  await db.withholdingTaxes.delete(args.id);
}

// --- Corporate Actions (edit/delete) ---

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

/**
 * Validate and normalize carry-in fields: positive quantity, a year, an
 * upper-cased symbol and non-negative costs. Only fields present in `changes`
 * are checked.
 */
export function normalizeCarryInChanges(
  changes: Partial<CarryInPosition>,
): Partial<CarryInPosition> {
  const out = { ...changes };
  if ('symbol' in out) {
    const symbol = (out.symbol ?? '').trim().toUpperCase();
    if (!symbol) throw new Error('Carry-in symbol is required');
    out.symbol = symbol;
  }
  if ('quantity' in out) {
    if (out.quantity === undefined || !(out.quantity > 0)) {
      throw new Error('Carry-in quantity must be greater than 0');
    }
  }
  if ('year' in out) {
    if (out.year === undefined || !Number.isInteger(out.year)) {
      throw new Error('Carry-in year is required');
    }
  }
  for (const field of ['costBasis', 'costBasisPln'] as const) {
    const value = out[field];
    if (value !== undefined && !(value >= 0)) {
      throw new Error(`Carry-in ${field} must be a non-negative number`);
    }
  }
  if (out.currency !== undefined) {
    out.currency = out.currency.trim().toUpperCase() || undefined;
  }
  return out;
}

export async function addCarryInPosition(args: {
  sessionId: string;
  position: CarryInPosition;
}): Promise<number> {
  const position = {
    ...args.position,
    ...normalizeCarryInChanges(args.position),
  };
  const id = await db.carryInPositions.add({
    ...position,
    sessionId: args.sessionId,
  });
  if (id === undefined) throw new Error('Failed to insert carry-in position');
  return id;
}

export async function updateCarryInPosition(args: {
  id: number;
  changes: Partial<CarryInPosition>;
}): Promise<void> {
  await db.carryInPositions.update(
    args.id,
    normalizeCarryInChanges(args.changes),
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
