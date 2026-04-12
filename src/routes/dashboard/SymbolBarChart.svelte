<script lang="ts">
  import {
    VisGroupedBar,
    VisAxis,
    VisXYContainer,
    VisTooltip,
  } from '@unovis/svelte';
  import { GroupedBar, Orientation } from '@unovis/ts';
  import { m } from '$lib/paraglide/messages.js';
  import { formatPln, formatPlnValue } from '$lib/utils/format-pln.js';
  import type { TradeResultRecord } from '$lib/db.js';

  interface Props {
    tradeResults: TradeResultRecord[];
    year: number;
  }

  let { tradeResults, year }: Props = $props();

  interface BarDatum {
    symbol: string;
    proceeds: number;
    cost: number;
    gainLoss: number;
  }

  const MAX_SYMBOLS = 10;

  const barData: BarDatum[] = $derived.by(() => {
    // Aggregate by symbol (sell trades only)
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local to $derived computation, not reactive state
    const bySymbol = new Map<
      string,
      { proceeds: number; cost: number }
    >();
    for (const trade of tradeResults) {
      if (trade.type !== 'sell') continue;
      const current = bySymbol.get(trade.symbol) ?? {
        proceeds: 0,
        cost: 0,
      };
      current.proceeds += trade.proceedsPln;
      current.cost += trade.costPln;
      bySymbol.set(trade.symbol, current);
    }

    if (bySymbol.size === 0) return [];

    // Sort by proceeds descending
    const sorted = [...bySymbol.entries()].sort(
      (a, b) => b[1].proceeds - a[1].proceeds,
    );

    const result: BarDatum[] = [];
    let otherProceeds = 0;
    let otherCost = 0;

    for (let i = 0; i < sorted.length; i++) {
      const [symbol, data] = sorted[i];
      if (i < MAX_SYMBOLS) {
        result.push({
          symbol,
          proceeds: data.proceeds,
          cost: data.cost,
          gainLoss: data.proceeds - data.cost,
        });
      } else {
        otherProceeds += data.proceeds;
        otherCost += data.cost;
      }
    }

    if (otherProceeds > 0) {
      result.push({
        symbol: m.dash_other(),
        proceeds: otherProceeds,
        cost: otherCost,
        gainLoss: otherProceeds - otherCost,
      });
    }

    return result;
  });

  const chartHeight = $derived(Math.max(barData.length * 60, 120));

  const x = (_d: BarDatum, i: number) => i;

  const y = [
    (d: BarDatum) => d.proceeds,
    (d: BarDatum) => d.cost,
  ] as unknown as (d: BarDatum) => number;

  const barColors = ['#3b82f6', '#94a3b8'];

  const tooltipTriggers = $derived({
    // Each bar within a group gets the same datum (the BarDatum object)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [(GroupedBar as any).selectors.bar]: (datum: any): string => {
      if (!datum) return '';
      const gainClass = datum.gainLoss >= 0 ? 'color: #10b981' : 'color: #ef4444';
      const sign = datum.gainLoss >= 0 ? '+' : '';
      return `<div class="text-sm">
        <strong>${datum.symbol}</strong><br/>
        ${m.dash_proceeds()}: ${formatPln(datum.proceeds)}<br/>
        ${m.dash_cost_basis()}: ${formatPln(datum.cost)}<br/>
        <span style="${gainClass}">${sign}${formatPln(datum.gainLoss)}</span>
      </div>`;
    },
  });
</script>

<div class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
  <h3 class="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
    {m.dash_symbol_chart()}
  </h3>

  {#if barData.length === 0}
    <div class="flex h-32 items-center justify-center text-sm text-slate-400">
      {m.dash_no_trades({ year: String(year) })}
    </div>
  {:else}
    <div style="height: {chartHeight}px">
      <!-- @ts-expect-error Unovis Svelte 4 components used in Svelte 5 -->
      <VisXYContainer data={barData} height={chartHeight}>
        <!-- @ts-expect-error Unovis Svelte 4 components used in Svelte 5 -->
        <VisGroupedBar
          {x}
          {y}
          color={barColors}
          orientation={Orientation.Horizontal}
          roundedCorners={4}
          barMinHeight={2}
        />
        <!-- @ts-expect-error Unovis Svelte 4 components used in Svelte 5 -->
        <VisAxis
          type="x"
          tickFormat={(_: number, i: number) => barData[i]?.symbol ?? ''}
          gridLine={false}
        />
        <!-- @ts-expect-error Unovis Svelte 4 components used in Svelte 5 -->
        <VisAxis
          type="y"
          tickFormat={(v: number) => formatPlnValue(v)}
          label="PLN"
        />
        <!-- @ts-expect-error Unovis Svelte 4 components used in Svelte 5 -->
        <VisTooltip triggers={tooltipTriggers} />
      </VisXYContainer>
    </div>

    <!-- Legend -->
    <div class="mt-3 flex gap-4">
      <div class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
        <span class="inline-block h-2.5 w-2.5 rounded-full bg-blue-500"></span>
        {m.dash_proceeds()}
      </div>
      <div class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
        <span class="inline-block h-2.5 w-2.5 rounded-full bg-slate-400"></span>
        {m.dash_cost_basis()}
      </div>
    </div>

    <!-- Gain/loss labels -->
    <div class="mt-2 space-y-1">
      {#each barData as item (item.symbol)}
        <div class="flex items-center justify-between text-xs">
          <span class="text-slate-600 dark:text-slate-400">{item.symbol}</span>
          <span class={item.gainLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
            {item.gainLoss >= 0 ? '+' : ''}{formatPln(item.gainLoss)}
          </span>
        </div>
      {/each}
    </div>
  {/if}
</div>
