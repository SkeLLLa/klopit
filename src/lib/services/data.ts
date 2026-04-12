import type {
  CarryInPosition,
  CorporateAction,
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

// --- Dividends (edit/delete) ---

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

// --- Carry-in Positions (edit/delete) ---

export async function updateCarryInPosition(args: {
  id: number;
  changes: Partial<CarryInPosition>;
}): Promise<void> {
  await db.carryInPositions.update(args.id, args.changes);
}

export async function deleteCarryInPosition(args: {
  id: number;
}): Promise<void> {
  await db.carryInPositions.delete(args.id);
}
