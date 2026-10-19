import { m } from '$lib/paraglide/messages.js';

import { UNASSIGNED_ACCOUNT } from '../../core/tax/accounts.js';

/** Prefix for accounts the user typed in by hand. */
export const MANUAL_ACCOUNT_PREFIX = 'manual:';

/** Account label for display; IBKR ids are masked (U1234567 → U***4567). */
export function formatAccount(account: string): string {
  if (account === UNASSIGNED_ACCOUNT) return m.account_unassigned();
  const sep = account.indexOf(':');
  const broker = sep < 0 ? '' : account.slice(0, sep);
  const id = sep < 0 ? account : account.slice(sep + 1);
  if (broker === 'ibkr' && id.length > 5) {
    return `${id[0]}***${id.slice(-4)}`;
  }
  return id;
}

/**
 * Turns a user-typed label into a manual account; blank → undefined. Reuses an
 * existing account whose value matches case-insensitively.
 */
export function manualAccount(
  label: string,
  existing: readonly string[] = [],
): string | undefined {
  const trimmed = label.trim();
  if (!trimmed) return undefined;
  const value = `${MANUAL_ACCOUNT_PREFIX}${trimmed}`;
  const key = value.toLowerCase();
  return existing.find((account) => account.toLowerCase() === key) ?? value;
}
