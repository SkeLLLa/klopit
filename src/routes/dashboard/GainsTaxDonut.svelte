<script lang="ts">
  import { VisDonut, VisSingleContainer, VisTooltip } from '@unovis/svelte';
  import { Donut } from '@unovis/ts';
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

  interface DonutSegment {
    label: string;
    value: number;
    color: string;
  }

  const totalIncome = $derived(
    Math.max(taxSummary.capitalGainPln, 0) + taxSummary.totalDividendsPln + taxSummary.totalCreditInterestPln,
  );

  const segments: DonutSegment[] = $derived.by(() => {
    if (totalIncome <= 0) return [];

    const divDeductible = sumDeductibleWithholding({ rows: dividendResults });
    const divPlTax = taxSummary.totalDividendsPln * TAX_RATE;
    const divTaxToPay = sumDividendTaxToPay({ rows: dividendResults });

    const ciTax = taxSummary.totalCreditInterestPln * TAX_RATE;

    const netProfit =
      totalIncome - taxSummary.capitalGainTaxPostLcfPln - divPlTax - ciTax;

    return [
      {
        label: m.dash_net_profit(),
        value: Math.max(netProfit, 0),
        color: '#10b981',
      },
      {
        label: m.dash_capital_gains_tax(),
        value: taxSummary.capitalGainTaxPostLcfPln,
        color: '#ef4444',
      },
      {
        label: m.dash_dividend_tax_owed(),
        value: divTaxToPay,
        color: '#f97316',
      },
      {
        label: m.dash_withholding_tax(),
        value: divDeductible,
        color: '#f59e0b',
      },
      {
        label: m.dash_credit_interest_tax(),
        value: ciTax,
        color: '#06b6d4',
      },
    ].filter((s) => s.value > 0);
  });

  const value = (d: DonutSegment) => d.value;
  const color = (d: DonutSegment) => d.color;

  const tooltipTriggers = $derived({
    // Unovis prefixes selector keys with '.' internally — pass raw class name
    // D3 datum on donut segments is an arc object { data, value, startAngle, ... }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [(Donut as any).selectors.segment]: (arcDatum: any): string => {
      const d: DonutSegment = arcDatum.data;
      const pct =
        totalIncome > 0 ? ((d.value / totalIncome) * 100).toFixed(1) : '0';
      return `<div class="text-sm"><strong>${d.label}</strong><br/>${formatPln(d.value)} (${pct}%)</div>`;
    },
  });
</script>

<div class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
  <h3 class="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
    {m.dash_gains_vs_taxes()}
  </h3>

  {#if segments.length === 0}
    <div class="flex h-48 items-center justify-center text-sm text-slate-400">
      {m.dash_no_income()}
    </div>
  {:else}
    <div class="h-64">
      <!-- @ts-expect-error Unovis Svelte 4 components used in Svelte 5 -->
      <VisSingleContainer data={segments} height={256}>
        <!-- @ts-expect-error Unovis Svelte 4 components used in Svelte 5 -->
        <VisDonut
          {value}
          {color}
          arcWidth={40}
          centralLabel={formatPln(totalIncome)}
          centralSubLabel={m.dash_total_income()}
        />
        <!-- @ts-expect-error Unovis Svelte 4 components used in Svelte 5 -->
        <VisTooltip triggers={tooltipTriggers} />
      </VisSingleContainer>
    </div>

    <!-- Legend -->
    <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1">
      {#each segments as seg (seg.label)}
        <div class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
          <span
            class="inline-block h-2.5 w-2.5 rounded-full"
            style="background-color: {seg.color}"
          ></span>
          {seg.label}
        </div>
      {/each}
    </div>
  {/if}
</div>
