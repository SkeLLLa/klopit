<script lang="ts">
  import { onDestroy } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { formatPlnValue } from '$lib/utils/format-pln.js';
  import { roundToFullPln, roundToGroszUp } from '../../core/tax/rounding.js';

  let {
    label,
    poz,
    value,
    variant = 'computed',
    suffix = 'zl',
    highlighted = false,
  }: {
    label: string;
    poz?: number;
    value: number;
    variant?: 'computed' | 'placeholder';
    suffix?: string;
    highlighted?: boolean;
  } = $props();

  const rawDecimalFormatter = new Intl.NumberFormat('en-US', {
    useGrouping: false,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const fullPlnPositions = new Set([
    31, 35, 41, 45, 46, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63,
    64, 65,
  ]);

  const groszUpPositions = new Set([47, 49]);

  function roundToNearestGrosz(amount: number): number {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }

  const normalizedValue = $derived.by(() => {
    if (suffix === '%') return value;

    if (poz != null) {
      if (groszUpPositions.has(poz)) {
        return roundToGroszUp({ amount: value });
      }
      if (fullPlnPositions.has(poz)) {
        return roundToFullPln({ amount: value });
      }
      return roundToNearestGrosz(value);
    }

    return roundToNearestGrosz(value);
  });

  const formattedValue = $derived(
    suffix === '%'
      ? `${String(normalizedValue)}%`
      : `${formatPlnValue(normalizedValue)} ${suffix}`,
  );

  const rawValue = $derived.by(() => {
    if (suffix === '%') return String(normalizedValue);
    if (poz != null && fullPlnPositions.has(poz)) {
      return String(normalizedValue);
    }
    return rawDecimalFormatter.format(normalizedValue);
  });

  let copied = $state(false);
  let copiedResetTimeout: ReturnType<typeof setTimeout> | undefined;

  onDestroy(() => {
    if (copiedResetTimeout) clearTimeout(copiedResetTimeout);
  });

  async function handleCopy() {
    if (!globalThis.navigator?.clipboard) return;

    try {
      await navigator.clipboard.writeText(rawValue);
      copied = true;

      if (copiedResetTimeout) clearTimeout(copiedResetTimeout);
      copiedResetTimeout = setTimeout(() => {
        copied = false;
      }, 1200);
    } catch {
      return;
    }
  }
</script>

<div
  class="flex items-center gap-3 py-1.5"
  class:opacity-40={variant === 'placeholder'}
>
  <span class="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-300">
    {label}
  </span>
  {#if poz != null}
    <span
      class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-400"
    >
      {m.tax_poz()} {poz}
    </span>
  {/if}
  <button
    type="button"
    onclick={() => void handleCopy()}
    class="w-36 shrink-0 rounded border px-3 py-1 text-right font-mono text-sm tabular-nums transition
      {variant === 'placeholder'
      ? 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600 dark:hover:border-slate-700 dark:hover:bg-slate-800'
      : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-700'}
      {highlighted ? 'border-blue-300 bg-blue-50 font-semibold text-blue-900 hover:border-blue-400 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200 dark:hover:border-blue-600 dark:hover:bg-blue-900' : ''}
      {copied ? 'ring-2 ring-emerald-400/60 dark:ring-emerald-500/50' : ''}"
    title={copied ? m.tax_copy_value_done() : m.tax_copy_value_title()}
    aria-label={copied ? m.tax_copy_value_done() : m.tax_copy_value_title()}
  >
    {formattedValue}
  </button>
</div>
