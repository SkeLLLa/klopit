<script lang="ts">
  import { getLocale, locales, localizeHref } from '$lib/paraglide/runtime';
  import { page } from '$app/state';

  let { collapsed = false }: { collapsed?: boolean } = $props();

  const locale = $derived(getLocale());
  const currentPath = $derived(page.url.pathname);
  const nextLocale = $derived(() => {
    const idx = locales.indexOf(locale);
    return locales[(idx + 1) % locales.length];
  });
</script>

{#if collapsed}
  <a
    href={localizeHref(currentPath, { locale: nextLocale() })}
    data-sveltekit-reload
    class="rounded-[5px] px-2.5 py-0.5 text-[10px] font-medium border border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-500/25 dark:bg-emerald-500/12 dark:text-emerald-400 transition-colors"
    title={nextLocale().toUpperCase()}
  >
    {locale.toUpperCase()}
  </a>
{:else}
  <div class="flex gap-1">
    {#each locales as loc (loc)}
      <a
        href={localizeHref(currentPath, { locale: loc })}
        data-sveltekit-reload
        class="rounded-[5px] px-2.5 py-0.5 text-[10px] font-medium transition-colors
          {loc === locale
            ? 'border border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-500/25 dark:bg-emerald-500/12 dark:text-emerald-400'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}"
      >
        {loc.toUpperCase()}
      </a>
    {/each}
  </div>
{/if}
