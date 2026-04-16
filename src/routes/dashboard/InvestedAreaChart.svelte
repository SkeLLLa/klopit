<script lang="ts">
  import {
    VisArea,
    VisLine,
    VisAxis,
    VisXYContainer,
    VisCrosshair,
    VisTooltip,
  } from '@unovis/svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { formatPln } from '$lib/utils/format-pln.js';
  import { formatDate } from '$lib/utils/format-date.js';
  import type { TradeResultRecord, DividendResultRecord, CreditInterestResultRecord } from '$lib/db.js';

  interface Props {
    tradeResults: TradeResultRecord[];
    dividendResults: DividendResultRecord[];
    creditInterestResults: CreditInterestResultRecord[];
    year: number;
  }

  let { tradeResults, dividendResults, creditInterestResults, year }: Props = $props();

  interface DataPoint {
    date: Date;
    timestamp: number;
    invested: number;
    gains: number;
  }

  const chartData: DataPoint[] = $derived.by(() => {
    interface TimelineEvent {
      date: Date;
      investedDelta: number;
      gainsDelta: number;
    }

    const events: TimelineEvent[] = [];

    for (const trade of tradeResults) {
      const date = new Date(trade.datetime);
      if (trade.type === 'buy') {
        events.push({
          date,
          investedDelta: trade.price * trade.quantity * trade.exchangeRate,
          gainsDelta: 0,
        });
      } else {
        events.push({
          date,
          investedDelta: 0,
          gainsDelta: trade.gainLossPln,
        });
      }
    }

    for (const div of dividendResults) {
      events.push({
        date: new Date(div.date),
        investedDelta: 0,
        gainsDelta: div.amountPln - div.withholdingTaxPln,
      });
    }

    for (const interest of creditInterestResults) {
      events.push({
        date: new Date(interest.date),
        investedDelta: 0,
        gainsDelta: interest.amountPln,
      });
    }

    if (events.length === 0) return [];

    events.sort((a, b) => a.date.getTime() - b.date.getTime());

    let cumulativeInvested = 0;
    let cumulativeGains = 0;
    const points: DataPoint[] = [];

    for (const event of events) {
      cumulativeInvested += event.investedDelta;
      cumulativeGains += event.gainsDelta;
      points.push({
        date: event.date,
        timestamp: event.date.getTime(),
        invested: cumulativeInvested,
        gains: cumulativeGains,
      });
    }

    return points;
  });

  const hasBuys = $derived(chartData.some((d) => d.invested > 0));
  const hasGains = $derived(chartData.some((d) => d.gains !== 0));

  const x = (d: DataPoint) => d.timestamp;
  const yInvested = (d: DataPoint) => d.invested;
  const yGains = (d: DataPoint) => d.gains;

  function crosshairTemplate(d: DataPoint): string {
    if (!d) return '';
    const gainsColor = d.gains >= 0 ? '#10b981' : '#ef4444';
    const gainsSign = d.gains >= 0 ? '+' : '';
    return `<div class="text-sm">
      <strong>${formatDate(d.date)}</strong><br/>
      <span style="color: #3b82f6">${m.dash_total_invested()}: ${formatPln(d.invested)}</span><br/>
      <span style="color: ${gainsColor}">${m.dash_capital_gains()}: ${gainsSign}${formatPln(d.gains)}</span>
    </div>`;
  }
</script>

<div class="invested-area-chart rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
  <h3 class="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
    {m.dash_invested_over_time()}
  </h3>

  {#if chartData.length === 0}
    <div class="flex h-32 items-center justify-center text-sm text-slate-400">
      {m.dash_no_buys({ year: String(year) })}
    </div>
  {:else}
    <div class="h-64">
      <!-- @ts-expect-error Unovis Svelte 4 components used in Svelte 5 -->
      <VisXYContainer data={chartData} height={256}>
        {#if hasBuys}
          <!-- @ts-expect-error Unovis Svelte 4 components used in Svelte 5 -->
          <VisArea
            {x}
            y={yInvested}
            color="#3b82f6"
            opacity={0.1}
            curveType="stepAfter"
          />
          <!-- @ts-expect-error Unovis Svelte 4 components used in Svelte 5 -->
          <VisLine
            {x}
            y={yInvested}
            color="#3b82f6"
            curveType="stepAfter"
          />
        {/if}
        {#if hasGains}
          <!-- @ts-expect-error Unovis Svelte 4 components used in Svelte 5 -->
          <VisLine
            {x}
            y={yGains}
            color="#10b981"
            curveType="stepAfter"
          />
        {/if}
        <!-- @ts-expect-error Unovis Svelte 4 components used in Svelte 5 -->
        <VisAxis
          type="x"
          tickFormat={(v: number) => formatDate(new Date(v))}
          numTicks={5}
        />
        <!-- @ts-expect-error Unovis Svelte 4 components used in Svelte 5 -->
        <VisAxis
          type="y"
          tickFormat={(v: number) => formatPln(v)}
          gridLine={true}
        />
        <!-- @ts-expect-error Unovis Svelte 4 components used in Svelte 5 -->
        <VisTooltip />
        <!-- @ts-expect-error Unovis Svelte 4 components used in Svelte 5 -->
        <VisCrosshair
          {x}
          y={[yInvested, yGains]}
          color={['#3b82f6', '#10b981']}
          template={crosshairTemplate}
        />
      </VisXYContainer>
    </div>

    <!-- Legend -->
    <div class="mt-3 flex gap-4">
      <div class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
        <span class="inline-block h-2.5 w-2.5 rounded-full bg-blue-500"></span>
        {m.dash_total_invested()}
      </div>
      <div class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
        <span class="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
        {m.dash_capital_gains()}
      </div>
    </div>
  {/if}
</div>

<style>
  .invested-area-chart {
    --vis-axis-grid-line-dasharray: 4 4;
  }

  :global(.dark) .invested-area-chart {
    --vis-dark-axis-grid-color: #1e293b;
  }
</style>
