<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { formatPln } from '$lib/utils/format-pln.js';
  import type { TradeResultRecord } from '$lib/db.js';

  interface Props {
    tradeResults: TradeResultRecord[];
  }

  let { tradeResults }: Props = $props();

  interface Segment {
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

  const segments: Segment[] = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local to $derived computation, not reactive state
    const costByCurrency = new Map<string, number>();
    for (const trade of tradeResults) {
      if (trade.type === 'buy') {
        const investedPln = trade.price * trade.quantity * trade.exchangeRate;
        const current = costByCurrency.get(trade.currency) ?? 0;
        costByCurrency.set(trade.currency, current + investedPln);
      }
    }

    if (costByCurrency.size === 0) return [];

    const total = [...costByCurrency.values()].reduce((s, v) => s + v, 0);
    if (total <= 0) return [];

    const sorted = [...costByCurrency.entries()].sort((a, b) => b[1] - a[1]);

    const result: Segment[] = [];
    let otherTotal = 0;
    let colorIdx = 0;

    for (const [currency, value] of sorted) {
      if (value / total >= MIN_SHARE) {
        result.push({
          label: currency,
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

  const total = $derived(segments.reduce((sum, s) => sum + s.value, 0));

  function pct(value: number, t: number): string {
    if (t <= 0) return '0';
    return ((value / t) * 100).toFixed(1);
  }
</script>

<div class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
  <h3 class="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
    {m.dash_currency_exposure()}
  </h3>
  <p class="mb-3 text-xs text-slate-500 dark:text-slate-400">
    {formatPln(total)}
  </p>

  {#if segments.length === 0}
    <div class="flex h-16 items-center justify-center text-sm text-slate-400">
      {m.dash_no_portfolio()}
    </div>
  {:else}
    <div class="flex h-8 overflow-hidden rounded-md">
      {#each segments as seg (seg.label)}
        <div
          class="relative min-w-[2px]"
          style="width: {pct(seg.value, total)}%; background-color: {seg.color}"
          title="{seg.label}: {formatPln(seg.value)} ({pct(seg.value, total)}%)"
        ></div>
      {/each}
    </div>

    <div class="mt-3 space-y-1">
      {#each segments as seg (seg.label)}
        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <span
              class="inline-block h-2.5 w-2.5 rounded-full"
              style="background-color: {seg.color}"
            ></span>
            {seg.label}
          </div>
          <span class="text-slate-700 dark:text-slate-300">
            {formatPln(seg.value)}
            <span class="text-slate-400">({pct(seg.value, total)}%)</span>
          </span>
        </div>
      {/each}
    </div>
  {/if}
</div>
