<script lang="ts">
  import { Calendar } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { pageTitle } from '$lib/state/page-title.svelte.js';
  import { db } from '$lib/db.js';
  import { useLiveQuery } from '$lib/utils/live-query.svelte.js';
  import { getCachedRates } from '$lib/services/rates.js';
  import {
    formatDate,
    parseDate,
    toDateInput,
    datePlaceholder,
  } from '$lib/utils/format-date.js';

  $effect(() => {
    pageTitle.set(m.page_rates());
  });

  // --- Fetch control state ---
  let fetchCurrency = $state('USD');
  let fetchDateText = $state('');
  let parsedDate: Date | null = $state(null);
  let fetching = $state(false);
  let fetchError = $state('');
  let pickerRef: HTMLInputElement | null = $state(null);

  function handleDateInput() {
    parsedDate = parseDate(fetchDateText);
  }

  function openPicker() {
    if (!pickerRef) return;
    pickerRef.value = parsedDate ? toDateInput(parsedDate) : '';
    pickerRef.showPicker();
  }

  function handlePickerChange() {
    if (!pickerRef?.value) return;
    const d = new Date(pickerRef.value);
    if (!isNaN(d.getTime())) {
      parsedDate = d;
      fetchDateText = formatDate(d);
    }
  }

  async function handleFetch() {
    if (!fetchCurrency.trim() || !parsedDate) return;
    fetching = true;
    fetchError = '';
    try {
      const isoDate = toDateInput(parsedDate);
      await getCachedRates({
        currency: fetchCurrency.trim().toUpperCase(),
        startDate: isoDate,
        endDate: isoDate,
      });
    } catch (e) {
      fetchError = e instanceof Error ? e.message : String(e);
    } finally {
      fetching = false;
    }
  }

  // --- Rates table ---
  const ratesQuery = useLiveQuery(() => db.nbpRates.orderBy('date').toArray());

  const pivoted = $derived.by(() => {
    const rows = ratesQuery.current;
    if (!rows || rows.length === 0)
      return {
        currencies: [] as string[],
        rows: [] as { date: string; rates: (number | null)[] }[],
      };

    const byDate: Record<string, Record<string, number | null>> = {};
    const currencySeen: Record<string, true> = {};

    for (const r of rows) {
      currencySeen[r.currency] = true;
      byDate[r.date] ??= {};
      byDate[r.date][r.currency] = r.rate;
    }

    const currencies = Object.keys(currencySeen).sort();
    const pivotedRows = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, rates]) => ({
        date,
        rates: currencies.map((c) => rates[c] ?? null),
      }));

    return { currencies, rows: pivotedRows };
  });
</script>

<div class="space-y-4">
  <!-- Fetch control -->
  <div
    class="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
  >
    <div class="flex flex-col gap-1">
      <label
        for="fetch-currency"
        class="text-xs font-medium text-slate-500 dark:text-slate-400"
        >{m.data_currency()}</label
      >
      <input
        id="fetch-currency"
        type="text"
        bind:value={fetchCurrency}
        placeholder="USD"
        class="w-24 rounded border border-slate-300 px-2 py-1.5 text-sm uppercase dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
      />
    </div>
    <div class="flex flex-col gap-1">
      <label
        for="fetch-date"
        class="text-xs font-medium text-slate-500 dark:text-slate-400">{m.data_date()}</label
      >
      <div class="flex gap-1">
        <input
          id="fetch-date"
          type="text"
          bind:value={fetchDateText}
          oninput={handleDateInput}
          placeholder={datePlaceholder()}
          class="w-36 rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
        />
        <button
          type="button"
          onclick={openPicker}
          class="shrink-0 rounded border border-slate-300 px-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
          title={m.data_date()}
        >
          <Calendar size={16} />
        </button>
        <input
          bind:this={pickerRef}
          type="date"
          onchange={handlePickerChange}
          class="invisible absolute h-0 w-0"
          tabindex="-1"
          aria-hidden="true"
        />
      </div>
    </div>
    <button
      onclick={handleFetch}
      disabled={fetching || !fetchCurrency.trim() || !parsedDate}
      class="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
    >
      {fetching ? m.rates_fetching() : m.rates_fetch()}
    </button>
    {#if fetchError}
      <p class="text-sm text-red-600 dark:text-red-400">{fetchError}</p>
    {/if}
  </div>

  <!-- Rates table -->
  {#if !ratesQuery.current || ratesQuery.current.length === 0}
    <div class="flex flex-col items-center justify-center py-12 text-center">
      <p class="text-sm text-slate-500 dark:text-slate-400">{m.rates_empty()}</p>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr
            class="border-b border-slate-200 text-xs font-medium uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400"
          >
            <th class="px-3 py-2">{m.data_date()}</th>
            {#each pivoted.currencies as currency (currency)}
              <th class="px-3 py-2 text-right">{currency}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each pivoted.rows as row (row.date)}
            <tr
              class="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
            >
              <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100"
                >{formatDate(row.date)}</td
              >
              {#each row.rates as rate, i (pivoted.currencies[i])}
                <td
                  class="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300"
                >
                  {rate !== null ? rate.toFixed(4) : '\u2014'}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
