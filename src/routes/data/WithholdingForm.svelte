<script lang="ts">
  import { m } from '#lib/paraglide/messages.js';
  import { fromDateInput } from '#lib/utils/date-input.js';
  import type { RawWithholdingTax } from '../../core/types.js';

  let {
    onsave,
    oncancel,
  }: {
    onsave: (withholding: RawWithholdingTax) => void;
    oncancel: () => void;
  } = $props();

  type Field = 'symbol' | 'date' | 'amount' | 'currency';

  let symbol = $state('');
  let isin = $state('');
  let dateText = $state('');
  let type: 'withheld' | 'refund' = $state('withheld');
  let amount = $state('');
  let currency = $state('USD');
  let errors: Partial<Record<Field, string>> = $state({});

  function validate(): boolean {
    const e: Partial<Record<Field, string>> = {};
    if (!symbol.trim()) e.symbol = m.data_validation_required();
    if (!dateText || !fromDateInput(dateText)) e.date = m.data_validation_required();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) e.amount = m.data_validation_must_be_positive();
    if (!currency.trim()) e.currency = m.data_validation_required();
    errors = e;
    return Object.keys(e).length === 0;
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!validate()) return;
    const amt = parseFloat(amount);
    onsave({
      symbol: symbol.trim().toUpperCase(),
      isin: isin.trim() || undefined,
      currency: currency.trim().toUpperCase(),
      date: fromDateInput(dateText) as Date,
      amount: type === 'withheld' ? -amt : amt,
    });
  }
</script>

<form onsubmit={handleSubmit} class="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
    <div>
      <label for="withholding-symbol" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{m.data_symbol()}</label>
      <input id="withholding-symbol" type="text" bind:value={symbol} class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
      {#if errors.symbol}<span class="text-xs text-red-500">{errors.symbol}</span>{/if}
    </div>
    <div>
      <label for="withholding-isin" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{m.data_isin()}</label>
      <input id="withholding-isin" type="text" bind:value={isin} class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
    </div>
    <div>
      <label for="withholding-date" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{m.data_date()}</label>
      <input id="withholding-date" type="date" bind:value={dateText} class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
      {#if errors.date}<span class="text-xs text-red-500">{errors.date}</span>{/if}
    </div>
    <div>
      <label for="withholding-type" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{m.data_withholding_type()}</label>
      <select id="withholding-type" bind:value={type} class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
        <option value="withheld">{m.data_withholding_type_withheld()}</option>
        <option value="refund">{m.data_withholding_type_refund()}</option>
      </select>
    </div>
    <div>
      <label for="withholding-amount" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{m.data_amount()}</label>
      <input id="withholding-amount" type="number" step="any" min="0" bind:value={amount} class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
      {#if errors.amount}<span class="text-xs text-red-500">{errors.amount}</span>{/if}
    </div>
    <div>
      <label for="withholding-currency" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{m.data_currency()}</label>
      <input id="withholding-currency" type="text" bind:value={currency} class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
      {#if errors.currency}<span class="text-xs text-red-500">{errors.currency}</span>{/if}
    </div>
  </div>
  <p class="text-xs text-slate-500 dark:text-slate-400">{m.data_withholding_match_hint()}</p>
  <div class="flex justify-end gap-2">
    <button type="button" onclick={oncancel} class="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700">
      {m.data_cancel()}
    </button>
    <button type="submit" class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
      {m.data_save()}
    </button>
  </div>
</form>
