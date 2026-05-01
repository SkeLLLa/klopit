<script lang="ts">
  import GroundingLinks from '$lib/components/docs/GroundingLinks.svelte';
  import LegalClaim from '$lib/components/docs/LegalClaim.svelte';
  import type { GroundingSource } from '$lib/components/docs/grounding';
  import { m } from '$lib/paraglide/messages.js';
  import { pageTitle } from '$lib/state/page-title.svelte.js';

  pageTitle.set(m.page_docs_ibkr_w8ben());

  const sources: GroundingSource[] = [
    {
      key: 'irsW8ben',
      label: m.docs_ibkr_w8ben_links_irs(),
      href: 'https://www.irs.gov/forms-pubs/about-form-w-8-ben',
      quote: '“About Form W-8 BEN”',
    },
    {
      key: 'irsInstructions',
      label: 'IRS Instructions for Form W-8BEN',
      href: 'https://www.irs.gov/instructions/iw8ben',
      quote: '“Foreign persons are subject to U.S. tax at a 30% rate”',
    },
    {
      key: 'irsTreaty',
      label: 'IRS - Claiming tax treaty benefits',
      href: 'https://www.irs.gov/individuals/international-taxpayers/claiming-tax-treaty-benefits',
      quote: '“claim a reduced rate of withholding under an income tax treaty”',
    },
    {
      key: 'w8Expiry',
      label: 'IRS W-8BEN validity period',
      href: 'https://www.irs.gov/instructions/iw8ben',
      quote: '“last day of the third succeeding calendar year”',
    },
  ];
</script>

{#snippet citations(keys: string[])}
  <GroundingLinks {sources} {keys} />
{/snippet}

<div class="space-y-6">
  <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
    {m.page_docs_ibkr_w8ben()}
  </h1>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-200">
      {m.docs_ibkr_w8ben_intro_title()}
    </h2>
    <LegalClaim
      body={m.docs_ibkr_w8ben_intro_body()}
      {sources}
      keys={['irsW8ben', 'irsTreaty']}
    />
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-200">
      {m.docs_ibkr_w8ben_why_title()}
    </h2>
    <!-- eslint-disable svelte/no-at-html-tags -- Paraglide messages are compile-time constants -->
    <p class="text-slate-700 dark:text-slate-300">
      {@html m.docs_ibkr_w8ben_why_body()}
      {@render citations(['irsInstructions', 'irsTreaty'])}
    </p>
    <!-- eslint-enable svelte/no-at-html-tags -->
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-200">
      {m.docs_ibkr_w8ben_detect_title()}
    </h2>
    <p class="text-slate-700 dark:text-slate-300">
      {m.docs_ibkr_w8ben_detect_body()}
      {@render citations(['irsInstructions'])}
    </p>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-200">
      {m.docs_ibkr_w8ben_where_title()}
    </h2>
    <!-- eslint-disable svelte/no-at-html-tags -- Paraglide messages are compile-time constants -->
    <p class="text-slate-700 dark:text-slate-300">
      {@html m.docs_ibkr_w8ben_where_body()}
    </p>
    <!-- eslint-enable svelte/no-at-html-tags -->
    <p class="rounded border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/60 dark:bg-amber-500/10 dark:text-amber-200">
      {m.docs_ibkr_w8ben_renewal_note()}
      {@render citations(['w8Expiry'])}
    </p>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-200">
      {m.docs_ibkr_w8ben_links_title()}
    </h2>
    <GroundingLinks {sources} variant="list" />
  </section>
</div>
