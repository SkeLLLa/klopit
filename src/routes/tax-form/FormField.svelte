<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { formatPlnValue } from '$lib/utils/format-pln.js';

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

  const formattedValue = $derived(
    suffix === '%' ? `${String(value)}%` : `${formatPlnValue(value)} ${suffix}`,
  );
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
  <span
    class="w-36 shrink-0 rounded border px-3 py-1 text-right font-mono text-sm tabular-nums
      {variant === 'placeholder'
      ? 'border-slate-100 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600'
      : 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'}
      {highlighted ? 'border-blue-300 bg-blue-50 font-semibold text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200' : ''}"
  >
    {formattedValue}
  </span>
</div>
