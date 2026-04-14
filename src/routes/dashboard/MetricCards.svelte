<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { formatPln } from '$lib/utils/format-pln.js';
  import type { TaxSummaryRecord } from '$lib/db.js';
  import { TrendingUp, TrendingDown, Minus } from 'lucide-svelte';

  interface Props {
    taxSummary: TaxSummaryRecord;
    prevYearSummary?: TaxSummaryRecord;
    sellTradeCount: number;
    dividendCount: number;
  }

  let {
    taxSummary,
    prevYearSummary,
    sellTradeCount,
    dividendCount,
  }: Props = $props();

  const capitalGain = $derived(
    taxSummary.totalProceedsPln - taxSummary.totalCostPln,
  );

  const taxOwed = $derived(
    taxSummary.capitalGainTaxPostLcfPln + taxSummary.dividendTaxOwedPln,
  );

  const prevTaxOwed = $derived(
    prevYearSummary
      ? prevYearSummary.capitalGainTaxPostLcfPln +
          prevYearSummary.dividendTaxOwedPln
      : undefined,
  );

  const pit38TaxToPay = $derived(taxSummary.pit38[51]);
  const taxOwedSubtitle = $derived.by(() => {
    const diff = Math.abs(pit38TaxToPay - taxOwed);
    if (diff >= 0.01) {
      return `PIT-38: ${formatPln(pit38TaxToPay)}`;
    }
    return '';
  });

  interface CardData {
    label: string;
    value: number;
    subtitle: string;
    color: 'blue' | 'green' | 'red' | 'amber';
    prevValue?: number;
    lowerIsBetter: boolean;
  }

  const cards: CardData[] = $derived([
    {
      label: m.dash_tax_owed(),
      value: taxOwed,
      subtitle: taxOwedSubtitle,
      color: 'blue',
      prevValue: prevTaxOwed,
      lowerIsBetter: true,
    },
    {
      label: m.dash_capital_gains(),
      value: capitalGain,
      subtitle: m.dash_from_trades({ count: String(sellTradeCount) }),
      color: capitalGain >= 0 ? 'green' : 'red',
      prevValue: prevYearSummary
        ? prevYearSummary.totalProceedsPln - prevYearSummary.totalCostPln
        : undefined,
      lowerIsBetter: false,
    },
    {
      label: m.dash_dividend_income(),
      value: taxSummary.totalDividendsPln,
      subtitle: m.dash_from_dividends({ count: String(dividendCount) }),
      color: 'green',
      prevValue: prevYearSummary?.totalDividendsPln,
      lowerIsBetter: false,
    },
    {
      label: m.dash_withholding_paid(),
      value: taxSummary.totalWithholdingPln,
      subtitle: m.dash_credited(),
      color: 'amber',
      prevValue: prevYearSummary?.totalWithholdingPln,
      lowerIsBetter: true,
    },
  ]);

  const colorClasses: Record<string, string> = {
    blue: 'border-blue-200 dark:border-blue-800',
    green: 'border-emerald-200 dark:border-emerald-800',
    red: 'border-red-200 dark:border-red-800',
    amber: 'border-amber-200 dark:border-amber-800',
  };

  const valueColorClasses: Record<string, string> = {
    blue: 'text-blue-700 dark:text-blue-300',
    green: 'text-emerald-700 dark:text-emerald-300',
    red: 'text-red-700 dark:text-red-300',
    amber: 'text-amber-700 dark:text-amber-300',
  };
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
  {#each cards as card (card.label)}
    <div
      class="rounded-lg border bg-white p-4 dark:bg-slate-900 {colorClasses[card.color]}"
    >
      <p class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {card.label}
      </p>
      <p class="mt-1 text-2xl font-bold {valueColorClasses[card.color]}">
        {formatPln(card.value)}
      </p>
      {#if card.subtitle}
        <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {card.subtitle}
        </p>
      {/if}
      {#if card.prevValue !== undefined}
        {@const delta = card.value - card.prevValue}
        {@const favorable = card.lowerIsBetter ? delta < 0 : delta > 0}
        {@const neutral = card.color === 'amber'}
        <p class="mt-1 flex items-center gap-1 text-xs {neutral ? 'text-slate-500 dark:text-slate-400' : favorable ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}">
          {#if delta > 0}
            <TrendingUp size={12} />
          {:else if delta < 0}
            <TrendingDown size={12} />
          {:else}
            <Minus size={12} />
          {/if}
          {m.dash_vs_year({
            delta: (delta >= 0 ? '+' : '') + formatPln(delta),
            year: String(taxSummary.year - 1),
          })}
        </p>
      {/if}
    </div>
  {/each}
</div>
