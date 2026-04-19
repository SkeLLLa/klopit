<script lang="ts">
  import { Calendar } from 'lucide-svelte';
  import SveltyPicker from 'svelty-picker';
  import { m } from '$lib/paraglide/messages.js';
  import { formatDate, parseDate, datePlaceholder } from '$lib/utils/format-date.js';
  import type { RawDividend } from '../../core/types.js';

  const PICKER_FORMAT = 'yyyy-mm-dd';
  const pad = (n: number) => String(n).padStart(2, '0');

  function dateToPickerValue(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function pickerValueToDate(s: string): Date | null {
    const result = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!result) return null;
    const [, Y, M, D] = result;
    const d = new Date(+Y, +M - 1, +D);
    return isNaN(d.getTime()) ? null : d;
  }

  let {
    initial,
    defaultYear,
    onsave,
    oncancel,
  }: {
    initial?: Partial<RawDividend>;
    defaultYear?: number;
    onsave: (dividend: RawDividend) => void;
    oncancel: () => void;
  } = $props();

  let symbol = $state(initial?.symbol ?? '');
  let isin = $state(initial?.isin ?? '');
  let dateText = $state(initial?.date ? formatDate(initial.date) : '');
  let parsedDate: Date | null = $state(initial?.date ?? null);
  let pickerValue = $state(initial?.date ? dateToPickerValue(initial.date) : '');
  let amount = $state(initial?.amount?.toString() ?? '');
  let currency = $state(initial?.currency ?? 'USD');
  let errors: Record<string, string> = $state({});

  // Anchor the picker view to the session year when no date is set yet.
  $effect(() => {
    if (!pickerValue && !parsedDate && defaultYear) {
      pickerValue = `${defaultYear}-01-01`;
    }
  });

  function handleDateInput() {
    parsedDate = parseDate(dateText);
    pickerValue = parsedDate ? dateToPickerValue(parsedDate) : '';
  }

  // Fires only when user commits a date in svelty-picker.
  function handlePickerChange(value: string | string[] | null) {
    if (typeof value !== 'string') return;
    const d = pickerValueToDate(value);
    if (!d) return;
    parsedDate = d;
    dateText = formatDate(d);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!symbol.trim()) e.symbol = m.data_validation_required();
    if (!dateText.trim()) {
      e.date = m.data_validation_required();
    } else if (!parsedDate) {
      e.date = datePlaceholder();
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) e.amount = m.data_validation_must_be_positive();
    if (!currency.trim()) e.currency = m.data_validation_required();
    errors = e;
    return Object.keys(e).length === 0;
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!validate()) return;

    onsave({
      symbol: symbol.trim().toUpperCase(),
      isin: isin.trim() || undefined,
      currency: currency.trim().toUpperCase(),
      date: parsedDate as Date,
      amount: parseFloat(amount),
    });
  }
</script>

<form onsubmit={handleSubmit} class="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
    <div>
      <label for="dividend-symbol" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{m.data_dividend_symbol()}</label>
      <input id="dividend-symbol" type="text" bind:value={symbol} class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
      {#if errors.symbol}<span class="text-xs text-red-500">{errors.symbol}</span>{/if}
    </div>
    <div>
      <label for="dividend-isin" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{m.data_dividend_isin()}</label>
      <input id="dividend-isin" type="text" bind:value={isin} class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
    </div>
    <div>
      <label for="dividend-date" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{m.data_dividend_date()}</label>
      <div class="flex gap-1">
        <input id="dividend-date" type="text" bind:value={dateText} oninput={handleDateInput} placeholder={datePlaceholder()} class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
        <SveltyPicker bind:value={pickerValue} onChange={handlePickerChange} format={PICKER_FORMAT} mode="date" inputClasses="sdt-hidden-input">
          <button type="button" class="flex h-full shrink-0 items-center justify-center rounded border border-slate-300 px-2 py-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700" title={m.data_dividend_date()}>
            <Calendar size={16} />
          </button>
        </SveltyPicker>
      </div>
      {#if errors.date}<span class="text-xs text-red-500">{errors.date}</span>{/if}
    </div>
    <div>
      <label for="dividend-amount" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{m.data_dividend_amount()}</label>
      <input id="dividend-amount" type="number" step="any" min="0" bind:value={amount} class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
      {#if errors.amount}<span class="text-xs text-red-500">{errors.amount}</span>{/if}
    </div>
    <div>
      <label for="dividend-currency" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{m.data_dividend_currency()}</label>
      <input id="dividend-currency" type="text" bind:value={currency} class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
      {#if errors.currency}<span class="text-xs text-red-500">{errors.currency}</span>{/if}
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
