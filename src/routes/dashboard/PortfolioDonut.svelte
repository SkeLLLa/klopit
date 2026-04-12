<script lang="ts">
  import { VisDonut, VisSingleContainer, VisTooltip } from '@unovis/svelte';
  import { Donut } from '@unovis/ts';
  import { m } from '$lib/paraglide/messages.js';
  import { formatPln } from '$lib/utils/format-pln.js';
  import type { TradeResultRecord } from '$lib/db.js';

  interface Props {
    tradeResults: TradeResultRecord[];
  }

  let { tradeResults }: Props = $props();

  interface DonutSegment {
    label: string;
    value: number;
    color: string;
  }

  const CHART_COLORS = [
    '#3b82f6', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6',
    '#f43f5e', '#6366f1', '#84cc16', '#0ea5e9', '#a855f7',
  ];
  const OTHER_COLOR = '#94a3b8';
  const MIN_SHARE = 0.02;

  const segments: DonutSegment[] = $derived.by(() => {
    // Aggregate invested amount by symbol (buy trades only)
    // Buy TradeResults have costPln=0 by design — compute from price * quantity * exchangeRate
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local to $derived computation, not reactive state
    const costBySymbol = new Map<string, number>();
    for (const trade of tradeResults) {
      if (trade.type === 'buy') {
        const investedPln = trade.price * trade.quantity * trade.exchangeRate;
        const current = costBySymbol.get(trade.symbol) ?? 0;
        costBySymbol.set(trade.symbol, current + investedPln);
      }
    }

    if (costBySymbol.size === 0) return [];

    const total = [...costBySymbol.values()].reduce((s, v) => s + v, 0);
    if (total <= 0) return [];

    // Sort by cost descending
    const sorted = [...costBySymbol.entries()].sort((a, b) => b[1] - a[1]);

    const result: DonutSegment[] = [];
    let otherTotal = 0;
    let colorIdx = 0;

    for (const [symbol, value] of sorted) {
      if (value / total >= MIN_SHARE) {
        result.push({
          label: symbol,
          value,
          color: CHART_COLORS[colorIdx % CHART_COLORS.length],
        });
        colorIdx++;
      } else {
        otherTotal += value;
      }
    }

    if (otherTotal > 0) {
      result.push({
        label: m.dash_other(),
        value: otherTotal,
        color: OTHER_COLOR,
      });
    }

    return result;
  });

  const totalInvested = $derived(
    segments.reduce((sum, s) => sum + s.value, 0),
  );

  const value = (d: DonutSegment) => d.value;
  const color = (d: DonutSegment) => d.color;

  const tooltipTriggers = $derived({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [(Donut as any).selectors.segment]: (arcDatum: any): string => {
      const d: DonutSegment = arcDatum.data;
      const pct =
        totalInvested > 0
          ? ((d.value / totalInvested) * 100).toFixed(1)
          : '0';
      return `<div class="text-sm"><strong>${d.label}</strong><br/>${formatPln(d.value)} (${pct}%)</div>`;
    },
  });
</script>

<div class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
  <h3 class="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
    {m.dash_portfolio()}
  </h3>

  {#if segments.length === 0}
    <div class="flex h-48 items-center justify-center text-sm text-slate-400">
      {m.dash_no_portfolio()}
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
          centralLabel={formatPln(totalInvested)}
          centralSubLabel={m.dash_total_invested()}
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
