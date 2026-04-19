<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { localizeHref } from '$lib/paraglide/runtime';
  import { pageTitle } from '$lib/state/page-title.svelte.js';
  import { navigation } from '$lib/nav.js';
  import { FileText } from 'lucide-svelte';

  pageTitle.set(m.page_docs_ibi());

  const iconMap: Record<string, typeof FileText> = { FileText };

  const ibiSection = navigation
    .flatMap((s) => s.items)
    .flatMap((item) => item.children ?? [])
    .find((item) => item.labelKey === 'nav_docs_ibi');

  const descriptionKeys: Record<string, () => string> = {
    nav_docs_ibi_espp: m.page_docs_desc_ibi_espp,
  };

  function t(key: string): string {
    return (m as Record<string, (...args: unknown[]) => string>)[key]?.() ?? key;
  }
</script>

<div class="space-y-6">
  <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
    {m.page_docs_ibi()}
  </h1>

  <p class="text-slate-600 dark:text-slate-400">
    {m.page_docs_desc_ibi()}
  </p>

  <div class="grid gap-4 sm:grid-cols-2">
    {#each ibiSection?.children ?? [] as child (child.labelKey)}
      {@const Icon = iconMap[child.icon]}
      <a
        href={localizeHref(child.href)}
        class="group flex gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-emerald-600 dark:hover:bg-emerald-500/10"
      >
        {#if Icon}
          <Icon
            size={24}
            class="mt-0.5 shrink-0 text-slate-400 transition-colors group-hover:text-emerald-500 dark:text-slate-500"
          />
        {/if}
        <div>
          <h2 class="font-semibold text-slate-900 dark:text-slate-100">
            {t(child.labelKey)}
          </h2>
          {#if descriptionKeys[child.labelKey]}
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {descriptionKeys[child.labelKey]()}
            </p>
          {/if}
        </div>
      </a>
    {/each}
  </div>

  <!-- eslint-disable svelte/no-at-html-tags -->
  <p class="border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
    {@html m.docs_more_brokers_coming()}
  </p>
  <!-- eslint-enable svelte/no-at-html-tags -->
</div>
