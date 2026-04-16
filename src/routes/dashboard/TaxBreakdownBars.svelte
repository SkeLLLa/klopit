<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { formatPln } from '$lib/utils/format-pln.js';
  import type { TaxSummaryRecord, DividendResultRecord } from '$lib/db.js';
  import { TAX_RATE } from '../../core/types.js';
  import {
    sumDeductibleWithholding,
    sumDividendTaxToPay,
  } from '../../core/tax/aggregates.js';

  interface Props {
    taxSummary: TaxSummaryRecord;
    dividendResults: DividendResultRecord[];
  }

  let { taxSummary, dividendResults }: Props = $props();

  interface Segment {
    label: string;
    value: number;
    color: string;
  }

  // --- Capital gains breakdown ---
  const capitalGainsSegments: Segment[] = $derived.by(() => {
    const gain = taxSummary.capitalGainPln;
    if (gain <= 0) return [];

    const tax = taxSummary.capitalGainTaxPostLcfPln;
    const net = gain - tax;

    return [
      { label: m.dash_net_profit(), value: net, color: '#10b981' },
      { label: m.dash_capital_gains_tax(), value: tax, color: '#ef4444' },
    ].filter((s) => s.value > 0);
  });

  const capitalGainsTotal = $derived(
    capitalGainsSegments.reduce((sum, s) => sum + s.value, 0),
  );

  // --- Dividends breakdown (per-dividend, matching the table) ---
  const dividendSegments: Segment[] = $derived.by(() => {
    const total = dividendResults.reduce((s, d) => s + d.amountPln, 0);
    if (total <= 0) return [];

    const taxPl = total * TAX_RATE;
    const net = total - taxPl;
    const deductible = sumDeductibleWithholding({ rows: dividendResults });
    const toPay = sumDividendTaxToPay({ rows: dividendResults });

    return [
      { label: m.dash_net_profit(), value: net, color: '#10b981' },
      { label: m.dash_withholding_tax(), value: deductible, color: '#f59e0b' },
      { label: m.dash_dividend_tax_owed(), value: toPay, color: '#ef4444' },
    ].filter((s) => s.value > 0);
  });

  const dividendTotal = $derived(
    dividendSegments.reduce((sum, s) => sum + s.value, 0),
  );

  // --- Credit interest breakdown ---
  const creditInterestSegments: Segment[] = $derived.by(() => {
    const total = taxSummary.totalCreditInterestPln;
    if (total <= 0) return [];

    const tax = total * TAX_RATE;
    const net = total - tax;

    return [
      { label: m.dash_net_profit(), value: net, color: '#10b981' },
      { label: m.dash_credit_interest_tax(), value: tax, color: '#06b6d4' },
    ].filter((s) => s.value > 0);
  });

  const creditInterestTotal = $derived(
    creditInterestSegments.reduce((sum, s) => sum + s.value, 0),
  );

  function pct(value: number, total: number): string {
    if (total <= 0) return '0';
    return ((value / total) * 100).toFixed(1);
  }
</script>

<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
  <!-- Capital Gains -->
  <div
    class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
  >
    <h3 class="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
      {m.dash_capital_gains()}
    </h3>
    <p class="mb-3 text-xs text-slate-500 dark:text-slate-400">
      {formatPln(capitalGainsTotal)}
    </p>

    {#if capitalGainsSegments.length === 0}
      <div
        class="flex h-16 items-center justify-center text-sm text-slate-400"
      >
        {m.dash_no_income()}
      </div>
    {:else}
      <div class="flex h-8 overflow-hidden rounded-md">
        {#each capitalGainsSegments as seg (seg.label)}
          <div
            class="relative min-w-[2px]"
            style="width: {pct(seg.value, capitalGainsTotal)}%; background-color: {seg.color}"
            title="{seg.label}: {formatPln(seg.value)} ({pct(seg.value, capitalGainsTotal)}%)"
          ></div>
        {/each}
      </div>

      <div class="mt-3 space-y-1">
        {#each capitalGainsSegments as seg (seg.label)}
          <div class="flex items-center justify-between text-xs">
            <div
              class="flex items-center gap-1.5 text-slate-600 dark:text-slate-400"
            >
              <span
                class="inline-block h-2.5 w-2.5 rounded-full"
                style="background-color: {seg.color}"
              ></span>
              {seg.label}
            </div>
            <span class="text-slate-700 dark:text-slate-300">
              {formatPln(seg.value)}
              <span class="text-slate-400">
                ({pct(seg.value, capitalGainsTotal)}%)
              </span>
            </span>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Dividends -->
  <div
    class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
  >
    <h3 class="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
      {m.dash_dividend_income()}
    </h3>
    <p class="mb-3 text-xs text-slate-500 dark:text-slate-400">
      {formatPln(dividendTotal)}
    </p>

    {#if dividendSegments.length === 0}
      <div
        class="flex h-16 items-center justify-center text-sm text-slate-400"
      >
        {m.dash_no_income()}
      </div>
    {:else}
      <div class="flex h-8 overflow-hidden rounded-md">
        {#each dividendSegments as seg (seg.label)}
          <div
            class="relative min-w-[2px]"
            style="width: {pct(seg.value, dividendTotal)}%; background-color: {seg.color}"
            title="{seg.label}: {formatPln(seg.value)} ({pct(seg.value, dividendTotal)}%)"
          ></div>
        {/each}
      </div>

      <div class="mt-3 space-y-1">
        {#each dividendSegments as seg (seg.label)}
          <div class="flex items-center justify-between text-xs">
            <div
              class="flex items-center gap-1.5 text-slate-600 dark:text-slate-400"
            >
              <span
                class="inline-block h-2.5 w-2.5 rounded-full"
                style="background-color: {seg.color}"
              ></span>
              {seg.label}
            </div>
            <span class="text-slate-700 dark:text-slate-300">
              {formatPln(seg.value)}
              <span class="text-slate-400">
                ({pct(seg.value, dividendTotal)}%)
              </span>
            </span>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Credit Interest -->
  <div
    class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
  >
    <h3 class="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
      {m.dash_credit_interest_income()}
    </h3>
    <p class="mb-3 text-xs text-slate-500 dark:text-slate-400">
      {formatPln(creditInterestTotal)}
    </p>

    {#if creditInterestSegments.length === 0}
      <div
        class="flex h-16 items-center justify-center text-sm text-slate-400"
      >
        {m.dash_no_income()}
      </div>
    {:else}
      <div class="flex h-8 overflow-hidden rounded-md">
        {#each creditInterestSegments as seg (seg.label)}
          <div
            class="relative min-w-[2px]"
            style="width: {pct(seg.value, creditInterestTotal)}%; background-color: {seg.color}"
            title="{seg.label}: {formatPln(seg.value)} ({pct(seg.value, creditInterestTotal)}%)"
          ></div>
        {/each}
      </div>

      <div class="mt-3 space-y-1">
        {#each creditInterestSegments as seg (seg.label)}
          <div class="flex items-center justify-between text-xs">
            <div
              class="flex items-center gap-1.5 text-slate-600 dark:text-slate-400"
            >
              <span
                class="inline-block h-2.5 w-2.5 rounded-full"
                style="background-color: {seg.color}"
              ></span>
              {seg.label}
            </div>
            <span class="text-slate-700 dark:text-slate-300">
              {formatPln(seg.value)}
              <span class="text-slate-400">
                ({pct(seg.value, creditInterestTotal)}%)
              </span>
            </span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
