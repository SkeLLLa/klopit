<script lang="ts">
  import GroundingLinks from '$lib/components/docs/GroundingLinks.svelte';
  import LegalClaim from '$lib/components/docs/LegalClaim.svelte';
  import type { GroundingSource } from '$lib/components/docs/grounding';
  import { ArrowRight } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { localizeHref } from '$lib/paraglide/runtime';
  import { pageTitle } from '$lib/state/page-title.svelte.js';

  pageTitle.set(m.page_pitzg_h1());

  const sources: GroundingSource[] = [
    {
      key: 'pitzgForm',
      href: 'https://www.gov.pl/web/finanse/pitzg',
      label: m.page_pitzg_links_mf_title(),
      quote: '„PIT/ZG”',
    },
    {
      key: 'pitAct',
      href: 'https://isap.sejm.gov.pl/isap.nsf/download.xsp/WDU19910800350/U/D19910350Lj.pdf',
      label: m.page_pitzg_links_pit_act_title(),
      quote: '„podatek dochodowy wynosi 19% uzyskanego dochodu”',
    },
    {
      key: 'oecd',
      href: 'https://www.oecd.org/en/topics/sub-issues/tax-treaties/model-tax-convention-on-income-and-on-capital.html',
      label: m.page_pitzg_links_oecd_title(),
      quote: '“Capital gains”',
    },
    {
      key: 'art30b',
      href: 'https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30b/',
      label: m.page_pitzg_links_lexlege_title(),
      quote: '„z odpłatnego zbycia papierów wartościowych”',
    },
    {
      key: 'pit38Guide',
      href: 'https://www.podatki.gov.pl/pit/',
      label: m.page_pitzg_links_tax_portal_title(),
      quote: '„PIT”',
    },
    {
      key: 'pit38Foreign',
      href: 'https://www.podatki.gov.pl/twoj-e-pit/pit-38-za-2025-rok/',
      label: 'podatki.gov.pl - PIT-38 i dochody z zagranicy',
      quote: '„automatycznie dołączy do zeznania załącznik PIT/ZG”',
    },
  ];
</script>

{#snippet citations(keys: string[])}
  <GroundingLinks {sources} {keys} />
{/snippet}

<article class="space-y-8">
  <header class="space-y-3">
    <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
      {m.page_pitzg_h1()}
    </h1>
    <LegalClaim body={m.page_pitzg_intro()} {sources} keys={['pitzgForm', 'art30b']} />
  </header>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {m.page_pitzg_sec1_title()}
    </h2>
    <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {m.page_pitzg_sec1_body()}
      {@render citations(['pitzgForm', 'pit38Foreign'])}
    </p>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {m.page_pitzg_sec2_title()}
    </h2>
    <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {m.page_pitzg_sec2_body()}
      {@render citations(['art30b', 'pit38Foreign'])}
    </p>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {m.page_pitzg_sec3_title()}
    </h2>
    <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {m.page_pitzg_sec3_body()}
      {@render citations(['pitAct'])}
    </p>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {m.page_pitzg_sec4_title()}
    </h2>
    <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {m.page_pitzg_sec4_body()}
      {@render citations(['oecd'])}
    </p>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {m.page_pitzg_sec5_title()}
    </h2>
    <ul class="list-disc space-y-2 pl-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      <li>{m.page_pitzg_sec5_b1()}{@render citations(['oecd'])}</li>
      <li>{m.page_pitzg_sec5_b2()}{@render citations(['oecd'])}</li>
      <li>{m.page_pitzg_sec5_b3()}{@render citations(['oecd'])}</li>
      <li>{m.page_pitzg_sec5_b4()}</li>
    </ul>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {m.page_pitzg_sec6_title()}
    </h2>
    <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {m.page_pitzg_sec6_body()}
      {@render citations(['pit38Foreign'])}
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
    <GroundingLinks {sources} variant="list" />
  </section>
</article>
