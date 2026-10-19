import type { CarryInWarning } from '../../core/tax/capital-gains.js';

/** What the "Add transfer" form starts with. */
export interface TransferPrefill {
  fromAccount?: string;
  toAccount?: string;
  quantity?: number;
  symbol?: string;
  isin?: string;
  datetime?: Date;
}

/** Hash of the Data page that opens the "Add transfer" form. */
export const TRANSFER_HASH = '#transfer';

/** Data page link that opens the form prefilled from a transfer warning. */
export function transferHref(
  warning: Extract<CarryInWarning, { kind: 'transfer-suggested' }>,
): string {
  const params = new URLSearchParams({
    from: warning.fromAccount,
    to: warning.toAccount,
    quantity: String(warning.quantity),
    symbol: warning.instrument,
    date: String(warning.before.getTime()),
  });
  if (warning.isin) params.set('isin', warning.isin);
  return `/data?${params.toString()}${TRANSFER_HASH}`;
}

/** Inverse of {@link transferHref}; unknown or malformed values are dropped. */
export function parseTransferPrefill(search: string): TransferPrefill {
  const params = new URLSearchParams(search);
  const quantity = Number(params.get('quantity'));
  const time = Number(params.get('date'));
  const date = new Date(time);
  return {
    fromAccount: params.get('from') || undefined,
    toAccount: params.get('to') || undefined,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : undefined,
    symbol: params.get('symbol') || undefined,
    isin: params.get('isin') || undefined,
    datetime:
      params.get('date') && !Number.isNaN(date.getTime()) ? date : undefined,
  };
}
