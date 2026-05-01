<script lang="ts">
  import { ExternalLink } from 'lucide-svelte';
  import type { GroundingLinkVariant } from './grounding';

  interface Props {
    href: string;
    label: string;
    number?: number;
    quote?: string;
    variant?: GroundingLinkVariant;
    external?: boolean;
    ariaLabel?: string;
    class?: string;
  }

  let {
    href,
    label,
    number,
    quote,
    variant = 'inlineText',
    external = true,
    ariaLabel,
    class: className = '',
  }: Props = $props();

  const titleText = $derived(quote ? `${label}: ${quote}` : label);
  const resolvedAriaLabel = $derived(ariaLabel ?? label);
</script>

{#if variant === 'inlineCitation'}
  <a
    href={href}
    target={external ? '_blank' : undefined}
    rel={external ? 'noopener noreferrer' : undefined}
    aria-label={resolvedAriaLabel}
    title={titleText}
    class={`group inline-flex max-w-full items-stretch overflow-hidden rounded-md border border-slate-200 bg-white font-medium text-slate-700 shadow-sm shadow-slate-950/[0.03] transition hover:border-emerald-300 hover:bg-emerald-50/70 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300 dark:shadow-none dark:hover:border-emerald-400/40 dark:hover:bg-emerald-400/10 dark:hover:text-slate-100 ${className}`}
  >
    {#if number !== undefined}
      <span
        class="flex min-w-7 items-center justify-center bg-slate-100 px-2 py-1 text-[0.66rem] font-bold leading-none text-slate-600 transition group-hover:bg-emerald-600 group-hover:text-white dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-emerald-300 dark:group-hover:text-emerald-950"
      >
        {number}
      </span>
    {/if}
    <span
      class="truncate px-1.5 py-1 text-slate-700 group-hover:text-slate-950 dark:text-slate-300 dark:group-hover:text-slate-100"
    >
      {quote ?? label}
    </span>
  </a>
{:else if variant === 'sourceTile'}
  <a
    href={href}
    target={external ? '_blank' : undefined}
    rel={external ? 'noopener noreferrer' : undefined}
    aria-label={resolvedAriaLabel}
    title={titleText}
    class={`group flex min-h-12 overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm shadow-slate-950/[0.03] transition hover:border-emerald-300 hover:bg-emerald-50/70 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300 dark:shadow-none dark:hover:border-emerald-400/40 dark:hover:bg-emerald-400/10 dark:hover:text-slate-100 ${className}`}
  >
    {#if number !== undefined}
      <span
        class="flex w-11 shrink-0 items-center justify-center bg-slate-100 text-xs font-bold text-slate-600 transition group-hover:bg-emerald-600 group-hover:text-white dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-emerald-300 dark:group-hover:text-emerald-950"
      >
        {number}
      </span>
    {/if}
    <span class="flex min-w-0 flex-1 items-center gap-2 px-3 py-2">
      <span class="min-w-0 flex-1 truncate font-medium">{label}</span>
      {#if external}
        <ExternalLink
          size={14}
          class="shrink-0 text-slate-400 transition group-hover:text-emerald-600 dark:text-slate-500 dark:group-hover:text-emerald-300"
        />
      {/if}
    </span>
  </a>
{:else}
  <a
    href={href}
    target={external ? '_blank' : undefined}
    rel={external ? 'noopener noreferrer' : undefined}
    aria-label={resolvedAriaLabel}
    title={titleText}
    class={`inline-flex items-center gap-1 rounded-md px-1 font-semibold text-emerald-700 underline-offset-2 transition hover:bg-emerald-50 hover:text-emerald-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-400/10 dark:hover:text-emerald-100 ${className}`}
  >
    <span>{label}</span>
    {#if external}
      <ExternalLink size={13} class="shrink-0" />
    {/if}
  </a>
{/if}
