import { db } from '../db.js';

/** Distinct accounts across a session's trades, carry-ins and corporate actions. */
export async function listSessionAccounts(args: {
  sessionId: string;
}): Promise<string[]> {
  const { sessionId } = args;
  const [trades, carryIns, actions] = await Promise.all([
    db.trades.where('sessionId').equals(sessionId).toArray(),
    db.carryInPositions.where('sessionId').equals(sessionId).toArray(),
    db.corporateActions.where('sessionId').equals(sessionId).toArray(),
  ]);
  const accounts = new Set<string>();
  for (const row of [...trades, ...carryIns, ...actions]) {
    if (row.account) accounts.add(row.account);
    if ('fromAccount' in row && row.fromAccount) accounts.add(row.fromAccount);
    if ('toAccount' in row && row.toAccount) accounts.add(row.toAccount);
  }
  return [...accounts].toSorted();
}
