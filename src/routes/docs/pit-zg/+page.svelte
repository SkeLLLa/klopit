<script lang="ts">
  import { ArrowRight, ExternalLink } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { localizeHref } from '$lib/paraglide/runtime';
  import { pageTitle } from '$lib/state/page-title.svelte.js';

  pageTitle.set(m.page_pitzg_h1());

  const externalLinks = [
    {
      href: 'https://www.gov.pl/web/finanse/pitzg',
      title: m.page_pitzg_links_mf_title(),
      desc: m.page_pitzg_links_mf_desc(),
    },
    {
      href: 'https://isap.sejm.gov.pl/isap.nsf/download.xsp/WDU19910800350/U/D19910350Lj.pdf',
      title: m.page_pitzg_links_pit_act_title(),
      desc: m.page_pitzg_links_pit_act_desc(),
    },
    {
      href: 'https://www.oecd.org/en/topics/sub-issues/tax-treaties/model-tax-convention-on-income-and-on-capital.html',
      title: m.page_pitzg_links_oecd_title(),
      desc: m.page_pitzg_links_oecd_desc(),
    },
    {
      href: 'https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30b/',
      title: m.page_pitzg_links_lexlege_title(),
      desc: m.page_pitzg_links_lexlege_desc(),
    },
    {
      href: 'https://www.podatki.gov.pl/pit/',
      title: m.page_pitzg_links_tax_portal_title(),
      desc: m.page_pitzg_links_tax_portal_desc(),
    },
  ];
</script>

<article class="space-y-8">
  <header class="space-y-3">
    <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
      {m.page_pitzg_h1()}
    </h1>
    <p class="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
      {m.page_pitzg_intro()}
    </p>
  </header>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {m.page_pitzg_sec1_title()}
    </h2>
    <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {m.page_pitzg_sec1_body()}
    </p>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {m.page_pitzg_sec2_title()}
    </h2>
    <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {m.page_pitzg_sec2_body()}
    </p>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {m.page_pitzg_sec3_title()}
    </h2>
    <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {m.page_pitzg_sec3_body()}
    </p>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {m.page_pitzg_sec4_title()}
    </h2>
    <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {m.page_pitzg_sec4_body()}
    </p>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {m.page_pitzg_sec5_title()}
    </h2>
    <ul class="list-disc space-y-2 pl-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      <li>{m.page_pitzg_sec5_b1()}</li>
      <li>{m.page_pitzg_sec5_b2()}</li>
      <li>{m.page_pitzg_sec5_b3()}</li>
      <li>{m.page_pitzg_sec5_b4()}</li>
    </ul>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {m.page_pitzg_sec6_title()}
    </h2>
    <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {m.page_pitzg_sec6_body()}
    </p>
  </section>

  <section
    class="space-y-3 rounded-xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-500/25 dark:bg-emerald-500/10"
  >
    <h2 class="text-xl font-semibold text-emerald-900 dark:text-emerald-200">
      {m.page_pitzg_sec7_title()}
    </h2>
    <p class="text-sm leading-relaxed text-emerald-900/80 dark:text-emerald-200/80">
      {m.page_pitzg_sec7_body()}
    </p>
    <a
      href={localizeHref('/settings')}
      class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600"
    >
      {m.page_pitzg_sec7_cta()}
      <ArrowRight size={12} />
    </a>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {m.page_pitzg_sec8_title()}
    </h2>
    <div class="grid gap-3 sm:grid-cols-2">
      {#each externalLinks as link (link.href)}
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          class="group flex gap-3 rounded-lg border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-emerald-600 dark:hover:bg-emerald-500/10"
        >
          <ExternalLink
            size={18}
            class="mt-0.5 shrink-0 text-slate-400 transition-colors group-hover:text-emerald-500 dark:text-slate-500"
          />
          <div>
            <span class="block text-sm font-semibold text-slate-900 dark:text-slate-100">
              {link.title}
            </span>
            <span class="mt-1 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {link.desc}
            </span>
          </div>
        </a>
      {/each}
    </div>
  </section>
</article>
