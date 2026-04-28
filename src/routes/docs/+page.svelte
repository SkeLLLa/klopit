<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { localizeHref } from '$lib/paraglide/runtime';
  import { pageTitle } from '$lib/state/page-title.svelte.js';
  import { navigation, type NavItem } from '$lib/nav.js';
  import { ArrowRight, BookOpen, FileText, HelpCircle } from 'lucide-svelte';

  pageTitle.set(m.page_docs());

  const iconMap: Record<string, typeof FileText> = { BookOpen, FileText, HelpCircle };

  const docsSection = navigation
    .flatMap((s) => s.items)
    .find((item) => item.labelKey === 'nav_docs');

  const descriptionKeys: Record<string, () => string> = {
    nav_docs_pit38: m.page_docs_desc_pit38,
    nav_docs_pitzg: m.page_docs_desc_pitzg,
    nav_docs_brokers: m.page_docs_desc_brokers,
    nav_docs_div_usa: m.page_docs_desc_div_usa,
    nav_docs_ib: m.page_docs_desc_ib,
    nav_docs_ibi: m.page_docs_desc_ibi,
    nav_docs_ibkr_w8ben: m.page_docs_desc_ibkr_w8ben,
    nav_docs_ibi_espp: m.page_docs_desc_ibi_espp,
    nav_docs_ibi_rsu: m.page_docs_desc_ibi_rsu,
    nav_faq: m.page_docs_desc_faq,
  };

  function t(key: string): string {
    return (m as Record<string, (...args: unknown[]) => string>)[key]?.() ?? key;
  }

  function getDescription(item: NavItem): string | undefined {
    return descriptionKeys[item.labelKey]?.();
  }
</script>

<div class="space-y-6">
  <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
    {m.page_docs()}
  </h1>

  <p class="max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
    {m.page_docs_intro()}
  </p>

  <section class="space-y-2">
    <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">
      {m.page_docs_section_forms()}
    </h2>
    <p class="max-w-3xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
      {m.page_docs_section_forms_desc()}
    </p>
  </section>

  <section class="space-y-2">
    <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">
      {m.page_docs_section_brokers()}
    </h2>
    <p class="max-w-3xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
      {m.page_docs_section_brokers_desc()}
    </p>
  </section>

  <section class="space-y-2">
    <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">
      {m.page_docs_section_topics()}
    </h2>
    <p class="max-w-3xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
      {m.page_docs_section_topics_desc()}
    </p>
  </section>

  <div class="columns-1 gap-4 sm:columns-2">
    {#each docsSection?.children ?? [] as child (child.labelKey)}
      {@const Icon = iconMap[child.icon]}
      {@const desc = getDescription(child)}
      <div
        class="mb-4 break-inside-avoid rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
      >
        <a
          href={localizeHref(child.href)}
          class="group flex gap-4 p-5 transition-colors hover:bg-emerald-50/50 dark:hover:bg-emerald-500/10 {child.children?.length ? 'rounded-t-lg' : 'rounded-lg'}"
        >
          {#if Icon}
            <Icon
              size={24}
              class="mt-0.5 shrink-0 text-slate-400 transition-colors group-hover:text-emerald-500 dark:text-slate-500"
            />
          {/if}
          <div class="min-w-0 flex-1">
            <h2 class="font-semibold text-slate-900 dark:text-slate-100">
              {t(child.labelKey)}
            </h2>
            {#if desc}
              <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {desc}
              </p>
            {/if}
          </div>
          <ArrowRight
            size={16}
            class="mt-1 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-500 dark:text-slate-600"
          />
        </a>

        {#if child.children?.length}
          <div
            class="border-t border-slate-100 bg-slate-50/50 px-5 py-3 dark:border-slate-700/50 dark:bg-slate-800/50"
          >
            <ul class="space-y-2">
              {#each child.children as sub (sub.labelKey)}
                {@const SubIcon = iconMap[sub.icon]}
                {@const subDesc = getDescription(sub)}
                <li>
                  <a
                    href={localizeHref(sub.href)}
                    class="group flex items-start gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-white dark:hover:bg-slate-700/50"
                  >
                    {#if SubIcon}
                      <SubIcon
                        size={16}
                        class="mt-0.5 shrink-0 text-slate-400 transition-colors group-hover:text-emerald-500 dark:text-slate-500"
                      />
                    {/if}
                    <div class="min-w-0 flex-1">
                      <span
                        class="text-sm font-medium text-slate-700 group-hover:text-emerald-600 dark:text-slate-200 dark:group-hover:text-emerald-400"
                      >
                        {t(sub.labelKey)}
                      </span>
                      {#if subDesc}
                        <p class="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                          {subDesc}
                        </p>
                      {/if}
                    </div>
                  </a>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>
