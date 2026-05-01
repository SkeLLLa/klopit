<script lang="ts">
  import { Scale } from 'lucide-svelte';
  import { getLocale } from '$lib/paraglide/runtime';
  import GroundingLinks from './GroundingLinks.svelte';
  import type { GroundingSource } from './grounding';

  interface Props {
    body: string;
    sources: GroundingSource[];
    keys: string[];
    title?: string;
    class?: string;
  }

  let {
    body,
    sources,
    keys,
    title,
    class: className = '',
  }: Props = $props();

  const defaultTitles = {
    en: 'Legal claim',
    pl: 'Teza prawna',
    uk: 'Правова теза',
  } as const;

  const claimTitle = $derived(title ?? defaultTitles[getLocale()]);
</script>

<aside
  class={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03] dark:border-slate-700 dark:bg-slate-900/50 dark:shadow-none ${className}`}
>
  <div class="flex items-start gap-3">
    <span
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      aria-hidden="true"
    >
      <Scale size={16} />
    </span>
    <div class="min-w-0 flex-1 space-y-2">
      <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {claimTitle}
      </h2>
      <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {body}
        <GroundingLinks {sources} {keys} />
      </p>
    </div>
  </div>
</aside>
