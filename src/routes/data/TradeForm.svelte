<script lang="ts">
  import { Calendar } from 'lucide-svelte';
  import { untrack } from 'svelte';
  import SveltyPicker from 'svelty-picker';
  import { m } from '$lib/paraglide/messages.js';
  import {
    formatDatetime,
    parseDatetime,
    datetimePlaceholder,
  } from '$lib/utils/format-date.js';
  import type { Trade } from '../../core/types.js';

  const PICKER_FORMAT = 'yyyy-mm-dd hh:ii';
  const pad = (n: number) => String(n).padStart(2, '0');

  function dateToPickerValue(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function pickerValueToDate(s: string): Date | null {
    const result = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(s);
    if (!result) return null;
    const [, Y, M, D, h, mi] = result;
    const d = new Date(+Y, +M - 1, +D, +h, +mi);
    return isNaN(d.getTime()) ? null : d;
  }

  let {
    initial,
    defaultYear,
    onsave,
    oncancel,
  }: {
    initial?: Partial<Trade>;
    defaultYear?: number;
    onsave: (trade: Trade) => void;
    oncancel: () => void;
  } = $props();

  // Parent wraps this form in `{#key editingId}`, so `initial` is always a
  // fresh snapshot at construction time — intentionally non-reactive here.
  const seed = untrack(() => initial);
  let symbol = $state(seed?.symbol ?? '');
  let isin = $state(seed?.isin ?? '');
  let datetimeText = $state(seed?.datetime ? formatDatetime(seed.datetime) : '');
  let parsedDatetime: Date | null = $state(seed?.datetime ?? null);
  let pickerValue = $state(seed?.datetime ? dateToPickerValue(seed.datetime) : '');
  let type: 'buy' | 'sell' = $state(seed?.type ?? 'buy');
  let quantity = $state(seed?.quantity?.toString() ?? '');
  let price = $state(seed?.price?.toString() ?? '');
  let proceeds = $state(seed?.proceeds?.toString() ?? '');
  let proceedsManuallyEdited = $state(false);
  let lastAutoSource = $state(
    `${seed?.quantity?.toString() ?? ''}|${seed?.price?.toString() ?? ''}`,
  );
  let commission = $state(seed?.commission?.toString() ?? '0');
  let commissionCurrency = $state(seed?.commissionCurrency ?? '');
  let currency = $state(seed?.currency ?? 'USD');
  let errors: Record<string, string> = $state({});

  // Anchor the picker view to the session year when no date is set yet.
  // This only seeds svelty-picker's internal value; the text input stays
  // empty until the user actually confirms a date via onChange.
  $effect(() => {
    if (!pickerValue && !parsedDatetime && defaultYear) {
      pickerValue = `${defaultYear}-01-01 00:00`;
    }
  });

  function computedProceeds(): number | null {
    const qty = parseFloat(quantity);
    const p = parseFloat(price);
    if (isNaN(qty) || isNaN(p)) return null;
    return qty * p;
  }

  function formatAutoProceeds(value: number): string {
    return String(value);
  }

  $effect(() => {
    const source = `${quantity}|${price}`;
    const auto = computedProceeds();
    const qtyOrPriceChanged = source !== lastAutoSource;

    if (qtyOrPriceChanged && !proceedsManuallyEdited && auto !== null) {
      proceeds = formatAutoProceeds(auto);
    }

    if (qtyOrPriceChanged) {
      lastAutoSource = source;
    }
  });

  function handleProceedsInput() {
    const auto = computedProceeds();
    if (proceeds.trim() === '') {
      proceedsManuallyEdited = false;
      if (auto !== null) {
        proceeds = formatAutoProceeds(auto);
      }
      return;
    }
    proceedsManuallyEdited =
      auto === null || proceeds.trim() !== formatAutoProceeds(auto);
  }

  function handleDatetimeInput() {
    parsedDatetime = parseDatetime(datetimeText);
    pickerValue = parsedDatetime ? dateToPickerValue(parsedDatetime) : '';
  }

  // Fires only when user commits a date in svelty-picker.
  function handlePickerChange(value: string | string[] | null) {
    if (typeof value !== 'string') return;
    const d = pickerValueToDate(value);
    if (!d) return;
    parsedDatetime = d;
    datetimeText = formatDatetime(d);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!symbol.trim()) e.symbol = m.data_validation_required();
    if (!datetimeText.trim()) {
      e.datetime = m.data_validation_required();
    } else if (!parsedDatetime) {
      e.datetime = datetimePlaceholder();
    }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) e.quantity = m.data_validation_must_be_positive();
    const p = parseFloat(price);
    if (isNaN(p) || p < 0) e.price = m.data_validation_must_be_non_negative();
    if (!currency.trim()) e.currency = m.data_validation_required();
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
        <SveltyPicker bind:value={pickerValue} onChange={handlePickerChange} format={PICKER_FORMAT} mode="datetime" inputClasses="sdt-hidden-input">
          <button type="button" class="flex h-full shrink-0 items-center justify-center rounded border border-slate-300 px-2 py-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700" title={m.data_datetime()}>
            <Calendar size={16} />
          </button>
        </SveltyPicker>
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
      <input id="trade-proceeds" type="number" step="any" bind:value={proceeds} oninput={handleProceedsInput} placeholder="auto" class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
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

<style>
  /*
   * Visually hide svelty-picker's built-in text input but keep a bounding box
   * that matches the trigger button — floating-ui anchors the popup to this
   * input (see svelty-picker/dist/utils/actions.js), so display:none would
   * place the popup at the origin.
   */
  :global(.sdt-hidden-input) {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }

  /* Dark-theme tokens for svelty-picker popup. Light theme uses defaults. */
  :global(.dark .sdt-calendar-wrap) {
    --sdt-bg-main: #1e293b; /* slate-800 */
    --sdt-color: #e2e8f0; /* slate-200 */
    --sdt-header-color: #e2e8f0;
    --sdt-table-data-bg-hover: #334155; /* slate-700 */
    --sdt-header-btn-bg-hover: #334155;
    --sdt-bg-selected: #2563eb; /* blue-600 */
    --sdt-color-selected: #ffffff;
    --sdt-table-today-indicator: #64748b; /* slate-500 */
    --sdt-shadow-color: rgba(0, 0, 0, 0.6);
    --sdt-radius: 6px;
    /* Time/clock view tokens */
    --sdt-clock-bg: #0f172a; /* slate-900 */
    --sdt-clock-color: #e2e8f0;
    --sdt-clock-color-hover: #ffffff;
    --sdt-clock-time-bg: transparent;
    --sdt-clock-time-bg-hover: #334155;
    border: 1px solid #334155;
  }
</style>
