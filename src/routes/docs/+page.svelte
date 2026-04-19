<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { localizeHref } from '$lib/paraglide/runtime';
  import { pageTitle } from '$lib/state/page-title.svelte.js';
  import { navigation } from '$lib/nav.js';
  import { BookOpen, FileText, HelpCircle } from 'lucide-svelte';

  pageTitle.set(m.page_docs());

  const iconMap: Record<string, typeof FileText> = { BookOpen, FileText, HelpCircle };

  const docsSection = navigation
    .flatMap((s) => s.items)
    .find((item) => item.labelKey === 'nav_docs');

  const descriptionKeys: Record<string, () => string> = {
    nav_docs_pit38: m.page_docs_desc_pit38,
    nav_docs_ib: m.page_docs_desc_ib,
    nav_docs_ibi: m.page_docs_desc_ibi,
    nav_faq: m.page_docs_desc_faq,
  };

  function t(key: string): string {
    return (m as Record<string, (...args: unknown[]) => string>)[key]?.() ?? key;
  }
</script>

<div class="space-y-6">
  <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
    {m.page_docs()}
  </h1>

  <div class="grid gap-4 sm:grid-cols-2">
    {#each docsSection?.children ?? [] as child (child.labelKey)}
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
</div>
