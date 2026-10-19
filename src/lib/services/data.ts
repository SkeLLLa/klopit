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
import { normalizeCarryInPosition } from './carry-in.js';

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
