<script lang="ts">
  import { ExternalLink } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';

  let {
    symbol,
    class: klass = '',
  }: {
    symbol: string;
    class?: string;
  } = $props();

  const href = $derived(
    `https://stockanalysis.com/symbol-lookup/?q=${encodeURIComponent(symbol.trim())}`,
  );

  const tooltip = $derived(m.data_isin_lookup_title({ symbol }));
</script>

<a
  {href}
  target="_blank"
  rel="noopener noreferrer"
  class={`inline-flex items-center gap-1 rounded px-1.5 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-700 dark:hover:text-blue-400 ${klass}`}
  aria-label={tooltip}
  title={tooltip}
>
  <span
    class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] font-semibold leading-none"
    aria-hidden="true"
  >
    ?
  </span>
  <ExternalLink size={14} />
</a>
