<script lang="ts">
  import { Calendar } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import {
    formatDatetime,
    parseDatetime,
    toDatetimeLocal,
    datetimePlaceholder,
  } from '$lib/utils/format-date.js';
  import type { Trade } from '../../core/types.js';

  let {
    initial,
    onsave,
    oncancel,
  }: {
    initial?: Partial<Trade>;
    onsave: (trade: Trade) => void;
    oncancel: () => void;
  } = $props();

  let symbol = $state('');
  let isin = $state('');
  let datetimeText = $state('');
  let parsedDatetime: Date | null = $state(null);
  let type: 'buy' | 'sell' = $state('buy');
  let quantity = $state('');
  let price = $state('');
  let proceeds = $state('');
  let commission = $state('0');
  let commissionCurrency = $state('');
  let currency = $state('USD');

  // Populate from initial prop
  $effect(() => {
    if (initial) {
      symbol = initial.symbol ?? '';
      isin = initial.isin ?? '';
      datetimeText = initial.datetime ? formatDatetime(initial.datetime) : '';
      parsedDatetime = initial.datetime ?? null;
      type = initial.type ?? 'buy';
      quantity = initial.quantity?.toString() ?? '';
      price = initial.price?.toString() ?? '';
      proceeds = initial.proceeds?.toString() ?? '';
      commission = initial.commission?.toString() ?? '0';
      commissionCurrency = initial.commissionCurrency ?? '';
      currency = initial.currency ?? 'USD';
    }
  });

  let errors: Record<string, string> = $state({});
  let pickerRef: HTMLInputElement | null = $state(null);

  function handleDatetimeInput() {
    parsedDatetime = parseDatetime(datetimeText);
  }

  function openPicker() {
    if (!pickerRef) return;
    pickerRef.value = parsedDatetime ? toDatetimeLocal(parsedDatetime) : '';
    pickerRef.showPicker();
  }

  function handlePickerChange() {
    if (!pickerRef?.value) return;
    const d = new Date(pickerRef.value);
    if (!isNaN(d.getTime())) {
      parsedDatetime = d;
      datetimeText = formatDatetime(d);
    }
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!symbol.trim()) e.symbol = 'Required';
    if (!datetimeText.trim()) {
      e.datetime = 'Required';
    } else if (!parsedDatetime) {
      e.datetime = datetimePlaceholder();
    }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) e.quantity = 'Must be > 0';
    const p = parseFloat(price);
    if (isNaN(p) || p < 0) e.price = 'Must be >= 0';
    if (!currency.trim()) e.currency = 'Required';
    errors = e;
    return Object.keys(e).length === 0;
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!validate()) return;

    const qty = parseFloat(quantity);
    const p = parseFloat(price);
    const proc = proceeds ? parseFloat(proceeds) : qty * p;
    const comm = parseFloat(commission) || 0;

    onsave({
      symbol: symbol.trim().toUpperCase(),
      isin: isin.trim() || undefined,
      currency: currency.trim().toUpperCase(),
      datetime: parsedDatetime as Date,
      quantity: qty,
      price: p,
      proceeds: proc,
      commission: comm,
      commissionCurrency: (commissionCurrency.trim() || currency.trim()).toUpperCase(),
      type,
    });
  }
</script>

<form onsubmit={handleSubmit} class="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <div>
      <label for="trade-symbol" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{m.data_symbol()}</label>
      <input id="trade-symbol" type="text" bind:value={symbol} class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
      {#if errors.symbol}<span class="text-xs text-red-500">{errors.symbol}</span>{/if}
    </div>
    <div>
      <label for="trade-isin" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{m.data_isin()}</label>
      <input id="trade-isin" type="text" bind:value={isin} class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
    </div>
    <div>
      <label for="trade-datetime" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{m.data_datetime()}</label>
      <div class="flex gap-1">
        <input id="trade-datetime" type="text" bind:value={datetimeText} oninput={handleDatetimeInput} placeholder={datetimePlaceholder()} class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
        <button type="button" onclick={openPicker} class="shrink-0 rounded border border-slate-300 px-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700" title={m.data_datetime()}>
          <Calendar size={16} />
        </button>
        <input bind:this={pickerRef} type="datetime-local" onchange={handlePickerChange} class="invisible absolute h-0 w-0" tabindex="-1" aria-hidden="true" />
      </div>
      {#if errors.datetime}<span class="text-xs text-red-500">{errors.datetime}</span>{/if}
    </div>
    <div>
      <label for="trade-type" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{m.data_type()}</label>
      <select id="trade-type" bind:value={type} class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
        <option value="buy">{m.data_type_buy()}</option>
        <option value="sell">{m.data_type_sell()}</option>
      </select>
    </div>
    <div>
      <label for="trade-quantity" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{m.data_quantity()}</label>
      <input id="trade-quantity" type="number" step="any" min="0" bind:value={quantity} class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
      {#if errors.quantity}<span class="text-xs text-red-500">{errors.quantity}</span>{/if}
    </div>
    <div>
      <label for="trade-price" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{m.data_price()}</label>
      <input id="trade-price" type="number" step="any" min="0" bind:value={price} class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
      {#if errors.price}<span class="text-xs text-red-500">{errors.price}</span>{/if}
    </div>
    <div>
      <label for="trade-proceeds" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{m.data_proceeds()}</label>
      <input id="trade-proceeds" type="number" step="any" bind:value={proceeds} placeholder="auto" class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
    </div>
    <div>
      <label for="trade-currency" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{m.data_currency()}</label>
      <input id="trade-currency" type="text" bind:value={currency} class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
      {#if errors.currency}<span class="text-xs text-red-500">{errors.currency}</span>{/if}
    </div>
    <div>
      <label for="trade-commission" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{m.data_commission()}</label>
      <input id="trade-commission" type="number" step="any" bind:value={commission} class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
    </div>
    <div>
      <label for="trade-comm-currency" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{m.data_commission_currency()}</label>
      <input id="trade-comm-currency" type="text" bind:value={commissionCurrency} placeholder={currency} class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
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
