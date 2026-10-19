<script module lang="ts">
  import { createContext } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import type { CopyBlock } from '$lib/utils/tax-form-status.js';

  /**
   * Set by the tax-form page: while it returns a reason (stale session, or
   * incomplete results such as unavailable NBP rates) value copying is disabled.
   */
  export const [getCopyBlock, setCopyBlock] = createContext<() => CopyBlock>();

  /** Like `getCopyBlock`, but never blocked outside the tax-form page. */
  export function useCopyBlock(): () => CopyBlock {
    try {
      return getCopyBlock();
    } catch {
      return () => null;
    }
  }

  export function copyBlockMessage(reason: Exclude<CopyBlock, null>): string {
    return reason === 'stale'
      ? m.tax_form_copy_disabled_stale()
      : m.tax_form_copy_disabled_incomplete();
  }
</script>

<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Info } from 'lucide-svelte';
  import { formatPlnValue } from '$lib/utils/format-pln.js';

  let {
    label,
    poz,
    value,
    variant = 'computed',
    suffix = 'zl',
    highlighted = false,
    help,
  }: {
    label: string;
    poz?: number;
    value: number | string;
    variant?: 'computed' | 'placeholder';
    suffix?: string;
    highlighted?: boolean;
    help?: string;
  } = $props();

  const rawDecimalFormatter = new Intl.NumberFormat('en-US', {
    useGrouping: false,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Whole-złote fields: copied as integers (core already rounds them).
  const fullPlnPositions = new Set([
    31, 35, 41, 45, 46, 50, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64,
    65,
  ]);

  const formattedValue = $derived(
    typeof value === 'string'
      ? value
      : suffix === '%'
        ? `${String(value)}%`
        : `${formatPlnValue(value)} ${suffix}`,
  );

  const rawValue = $derived.by(() => {
    if (typeof value === 'string') return value;
    if (suffix === '%') return String(value);
    if (poz != null && fullPlnPositions.has(poz) && Number.isInteger(value)) {
      return String(value);
    }
    return rawDecimalFormatter.format(value);
  });

  const copyBlock = useCopyBlock();
  const blockReason = $derived(copyBlock());
  const copyDisabled = $derived(blockReason !== null);

  let copied = $state(false);
  let copiedResetTimeout: ReturnType<typeof setTimeout> | undefined;

  onDestroy(() => {
    if (copiedResetTimeout) clearTimeout(copiedResetTimeout);
  });

  async function handleCopy() {
    if (copyDisabled || !globalThis.navigator?.clipboard) return;

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
    {#if help}
      <span
        class="ml-1 inline-flex align-[-2px] text-slate-400"
        title={help}
        aria-label={help}
      >
        <Info size={13} />
      </span>
    {/if}
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
    disabled={copyDisabled}
    class="{typeof value === 'string' ? 'w-52 truncate text-left' : 'w-36 text-right'} shrink-0 rounded border px-3 py-1 font-mono text-sm tabular-nums transition disabled:cursor-not-allowed disabled:opacity-60
      {variant === 'placeholder'
      ? 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600 dark:hover:border-slate-700 dark:hover:bg-slate-800'
      : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-700'}
      {highlighted ? 'border-blue-300 bg-blue-50 font-semibold text-blue-900 hover:border-blue-400 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200 dark:hover:border-blue-600 dark:hover:bg-blue-900' : ''}
      {copied ? 'ring-2 ring-emerald-400/60 dark:ring-emerald-500/50' : ''}"
    title={blockReason
      ? copyBlockMessage(blockReason)
      : copied
        ? m.tax_copy_value_done()
        : m.tax_copy_value_title()}
    aria-label={blockReason
      ? copyBlockMessage(blockReason)
      : copied
        ? m.tax_copy_value_done()
        : m.tax_copy_value_title()}
  >
    {formattedValue}
  </button>
</div>
