<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { localizeHref } from '$lib/paraglide/runtime';

  const keywordLinks = $derived([
    { label: m.footer_kw_pit38(), href: '/tax-form' },
    { label: m.footer_kw_capital_gains(), href: '/dashboard' },
    { label: m.footer_kw_dividends(), href: '/dashboard' },
    { label: m.footer_kw_fifo(), href: '/docs/faq' },
    { label: m.footer_kw_nbp(), href: '/rates' },
    { label: m.footer_kw_pitzg(), href: '/tax-form' },
  ]);
</script>

<footer
  class="shrink-0 border-t border-slate-200 px-4 py-2.5 dark:border-slate-800"
>
  <nav aria-label="Footer" class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
    {#each keywordLinks as link, i (link.label)}
      {#if i > 0}
        <span class="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
      {/if}
      <a
        href={localizeHref(link.href)}
        class="text-[9px] text-slate-400 hover:text-emerald-600 dark:text-slate-500 dark:hover:text-emerald-400"
      >
        {link.label}
      </a>
    {/each}
  </nav>
  <p class="mt-1 text-center text-[9px] text-slate-400 dark:text-slate-500">
    {m.footer_eeat()} · {m.footer_text()}
  </p>
</footer>
