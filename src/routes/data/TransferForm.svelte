<script lang="ts">
  import { untrack } from 'svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { toDatetimeLocal } from '#lib/utils/format-date.js';
  import { fromDatetimeLocal } from '#lib/utils/date-input.js';
  import type { TransferPrefill } from '#lib/utils/transfer-link.js';
  import type { CorporateAction } from '../../core/types.js';
  import AccountField from './AccountField.svelte';

  let {
    initial,
    defaultYear,
    accounts = [],
    onsave,
    oncancel,
  }: {
    initial?: TransferPrefill;
    defaultYear?: number;
    /** Distinct accounts in the session. */
    accounts?: string[];
    onsave: (transfer: CorporateAction) => void;
    oncancel: () => void;
  } = $props();

  // Parent wraps this form in `{#key}`, so `initial` is a fresh snapshot at
  // construction time — intentionally non-reactive here.
  const seed = untrack(() => initial);
  let symbol = $state(seed?.symbol ?? '');
  let isin = $state(seed?.isin ?? '');
  let quantity = $state(seed?.quantity?.toString() ?? '');
  // svelte-ignore state_referenced_locally -- only seeds the initial value
  let datetime = $state(
    seed?.datetime
      ? toDatetimeLocal(seed.datetime)
      : defaultYear
        ? `${String(defaultYear)}-01-01T00:00`
        : '',
  );
  let fromAccount: string | undefined = $state(seed?.fromAccount);
  let toAccount: string | undefined = $state(seed?.toAccount);
  let errors: Record<string, string> = $state({});

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!symbol.trim()) e.symbol = m.data_validation_required();
    if (!fromDatetime()) e.datetime = m.data_validation_required();
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) e.quantity = m.data_validation_must_be_positive();
    if (!fromAccount) e.from = m.data_validation_required();
    if (!toAccount) e.to = m.data_validation_required();
    else if (toAccount === fromAccount) e.to = m.data_transfer_same_account();
    errors = e;
    return Object.keys(e).length === 0;
  }

  const fromDatetime = () => fromDatetimeLocal(datetime);

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!validate()) return;
    onsave({
      type: 'transfer',
      symbol: symbol.trim().toUpperCase(),
      isin: isin.trim() || undefined,
      datetime: fromDatetime() as Date,
      numerator: 1,
      denominator: 1,
      fromAccount,
      toAccount,
      quantity: parseFloat(quantity),
    });
  }

  const inputClass =
    'w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200';
  const labelClass =
    'mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400';
</script>

<form onsubmit={handleSubmit} class="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
  <p class="text-xs text-slate-500 dark:text-slate-400">{m.data_transfer_hint()}</p>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <div>
      <label for="transfer-symbol" class={labelClass}>{m.data_symbol()}</label>
      <input id="transfer-symbol" type="text" bind:value={symbol} class={inputClass} />
      {#if errors.symbol}<span class="text-xs text-red-500">{errors.symbol}</span>{/if}
    </div>
    <div>
      <label for="transfer-isin" class={labelClass}>{m.data_isin()}</label>
      <input id="transfer-isin" type="text" bind:value={isin} class={inputClass} />
    </div>
    <div>
      <label for="transfer-datetime" class={labelClass}>{m.data_datetime()}</label>
      <input id="transfer-datetime" type="datetime-local" bind:value={datetime} class={inputClass} />
      {#if errors.datetime}<span class="text-xs text-red-500">{errors.datetime}</span>{/if}
    </div>
    <div>
      <label for="transfer-quantity" class={labelClass}>{m.data_quantity()}</label>
      <input id="transfer-quantity" type="number" step="any" min="0" bind:value={quantity} class={inputClass} />
      {#if errors.quantity}<span class="text-xs text-red-500">{errors.quantity}</span>{/if}
    </div>
    <div>
      <label for="transfer-from" class={labelClass}>{m.data_transfer_from()}</label>
      <AccountField id="transfer-from" {accounts} value={fromAccount} onchange={(v) => (fromAccount = v)} />
      {#if errors.from}<span class="text-xs text-red-500">{errors.from}</span>{/if}
    </div>
    <div>
      <label for="transfer-to" class={labelClass}>{m.data_transfer_to()}</label>
      <AccountField id="transfer-to" {accounts} value={toAccount} onchange={(v) => (toAccount = v)} />
      {#if errors.to}<span class="text-xs text-red-500">{errors.to}</span>{/if}
    </div>
  </div>
  <div class="flex justify-end gap-2">
    <button type="button" onclick={oncancel} class="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700">
      {m.data_cancel()}
    </button>
    <button type="submit" class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
      {m.data_save()}
    </button>
  </div>
</form>
