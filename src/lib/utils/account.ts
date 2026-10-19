/** Prefix for accounts the user typed in by hand. */
export const MANUAL_ACCOUNT_PREFIX = 'manual:';

/** Account label for display; IBKR ids are masked (U1234567 → U***4567). */
export function formatAccount(account: string): string {
  const sep = account.indexOf(':');
  const broker = sep < 0 ? '' : account.slice(0, sep);
  const id = sep < 0 ? account : account.slice(sep + 1);
  if (broker === 'ibkr' && id.length > 5) {
    return `${id[0]}***${id.slice(-4)}`;
  }
  return id;
}

/** Stores a user-typed label as a manual account; blank → undefined. */
export function manualAccount(label: string): string | undefined {
  const trimmed = label.trim();
  return trimmed ? `${MANUAL_ACCOUNT_PREFIX}${trimmed}` : undefined;
}
