<script lang="ts">
  import { Calendar } from '@lucide/svelte';
  import { untrack } from 'svelte';
  import SveltyPicker from 'svelty-picker';
  import { m } from '#lib/paraglide/messages.js';
  import { formatDate, parseDate, datePlaceholder } from '#lib/utils/format-date.js';
  import {
    validateDividendInput,
    parseWithholding,
    type DividendInputError,
    type DividendInputField,
  } from '#lib/utils/dividend-input.js';
  import type { DividendCountryInfo } from '#lib/services/country-overrides.js';
  import { dividendMatchKey } from '../../core/tax/dividends.js';
  import { getDividendCreditCapRate } from '../../core/tax/treaty-rates.js';
  import type { RawDividend } from '../../core/types.js';

  export interface DividendFormResult {
    dividend: RawDividend;
    /** Positive tax withheld; undefined = leave the stored withholding alone. */
    withholding?: number | undefined;
    /** Source country to store as an override, only when it was asked for. */
    country?: string | undefined;
  }

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
    initialWithholding,
    withholdingLocked,
    resolveCountry,
    onsave,
    oncancel,
  }: {
    initial?: Partial<RawDividend> | undefined;
    defaultYear?: number | undefined;
    /** Positive tax withheld currently linked to this dividend. */
    initialWithholding?: number | undefined;
    /** True when imported withholding already exists for this match key. */
    withholdingLocked?: ((key: string) => boolean) | undefined;
    resolveCountry?:
      | ((symbol: string, isin: string) => Promise<DividendCountryInfo>)
      | undefined;
    onsave: (result: DividendFormResult) => void;
    oncancel: () => void;
  } = $props();

  // Parent wraps this form in `{#key editingId}`, so `initial` is always a
  // fresh snapshot at construction time — intentionally non-reactive here.
  const seed = untrack(() => initial);
  let symbol = $state(seed?.symbol ?? '');
  let isin = $state(seed?.isin ?? '');
  let dateText = $state(seed?.date ? formatDate(seed.date) : '');
  let parsedDate: Date | null = $state(seed?.date ?? null);
  let pickerValue = $state(seed?.date ? dateToPickerValue(seed.date) : '');
  let amount = $state(seed?.amount?.toString() ?? '');
  let currency = $state(seed?.currency ?? 'USD');
  let withholding = $state(untrack(() => initialWithholding)?.toString() ?? '');
  let country = $state('');
  let countryInfo = $state<DividendCountryInfo | null>(null);
  let errors: Partial<Record<DividendInputField, string>> = $state({});

  const locked = $derived(
    withholdingLocked !== undefined &&
      parsedDate !== null &&
      symbol.trim() !== '' &&
      currency.trim() !== '' &&
      withholdingLocked(
        dividendMatchKey({
          symbol: symbol.trim().toUpperCase(),
          isin: isin.trim() || undefined,
          currency: currency.trim(),
          date: parsedDate,
          kind: seed?.kind,
        }),
      ),
  );
  // Without a resolver the country is not asked for.
  const countryKnown = $derived(
    resolveCountry === undefined || (countryInfo !== null && countryInfo.source !== 'unknown'),
  );
  const countryInputShown = $derived(
    resolveCountry !== undefined &&
      countryInfo?.source === 'unknown' &&
      countryInfo.overrideScope === undefined,
  );
  const countryGainsOnly = $derived(
    countryInfo?.source === 'unknown' && countryInfo.overrideScope === 'gains',
  );

  let resolveSeq = 0;
  $effect(() => {
    const sym = symbol.trim().toUpperCase();
    const code = isin.trim();
    const seq = ++resolveSeq;
    if (!resolveCountry || !sym) {
      countryInfo = null;
      return;
    }
    void (async () => {
      const info = await resolveCountry(sym, code);
      if (seq === resolveSeq) countryInfo = info;
    })();
  });

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

  function errorText(code: DividendInputError): string {
    switch (code) {
      case 'required':
        return m.data_validation_required();
      case 'date-format':
        return datePlaceholder();
      case 'must-be-positive':
        return m.data_validation_must_be_positive();
      case 'must-be-non-negative':
        return m.data_validation_must_be_non_negative();
      case 'withholding-exceeds-gross':
        return m.data_validation_withholding_exceeds_gross();
      case 'country-code':
        return m.data_validation_country_code();
      case 'country-required-for-withholding':
        return m.data_validation_country_required_for_withholding();
    }
  }

  function validate(): boolean {
    const found = validateDividendInput({
      symbol,
      dateText,
      dateParsed: parsedDate !== null,
      amount,
      currency,
      withholding,
      withholdingLocked: locked,
      country,
      countryInputShown,
      countryKnown,
    });
    const e: Partial<Record<DividendInputField, string>> = {};
    for (const [field, code] of Object.entries(found)) {
      e[field as DividendInputField] = errorText(code);
    }
    errors = e;
    return Object.keys(e).length === 0;
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!validate()) return;

    const countryCode = country.trim().toUpperCase();
    onsave({
      dividend: {
        symbol: symbol.trim().toUpperCase(),
        isin: isin.trim() || undefined,
        currency: currency.trim().toUpperCase(),
        date: parsedDate as Date,
        amount: parseFloat(amount),
      },
      withholding: locked ? undefined : (parseWithholding(withholding) ?? 0),
      country: countryInputShown && countryCode ? countryCode : undefined,
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
    <div>
      <label for="dividend-withholding" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{m.data_dividend_withholding()}</label>
      <input id="dividend-withholding" type="number" step="any" min="0" bind:value={withholding} disabled={locked} aria-describedby="dividend-withholding-note" class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
      {#if errors.withholding}<span class="text-xs text-red-500">{errors.withholding}</span>{/if}
    </div>
    {#if countryInputShown}
      <div>
        <label for="dividend-country" class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{m.data_dividend_country()}</label>
        <input id="dividend-country" type="text" maxlength="2" bind:value={country} placeholder={m.data_country_override_placeholder()} class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm uppercase dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
        {#if errors.country}<span class="text-xs text-red-500">{errors.country}</span>{/if}
      </div>
    {/if}
  </div>
  <div id="dividend-withholding-note" class="space-y-1 text-xs text-slate-500 dark:text-slate-400">
    <p>{locked ? m.data_dividend_withholding_imported() : m.data_dividend_withholding_hint()}</p>
    {#if countryInfo && countryInfo.source !== 'unknown'}
      <p>
        {m.data_dividend_country_known({ country: countryInfo.country, rate: `${(getDividendCreditCapRate({ country: countryInfo.country }) * 100).toFixed(0)}%` })}
        {#if countryInfo.source === 'override'}
          {m.data_dividend_country_hint({ symbol: symbol.trim().toUpperCase() })}
        {/if}
      </p>
    {:else if countryGainsOnly}
      <p>{m.data_dividend_country_gains_only()}</p>
    {/if}
    {#if errors.country && !countryInputShown}<p class="text-red-500">{errors.country}</p>{/if}
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
