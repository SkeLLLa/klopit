<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { pageTitle } from '$lib/state/page-title.svelte.js';

  pageTitle.set(m.page_docs_ibkr_w8ben());

  const irsFormUrl = 'https://www.irs.gov/forms-pubs/about-form-w-8-ben';
</script>

<div class="space-y-6">
  <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
    {m.page_docs_ibkr_w8ben()}
  </h1>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-200">
      {m.docs_ibkr_w8ben_intro_title()}
    </h2>
    <p class="text-slate-700 dark:text-slate-300">
      {m.docs_ibkr_w8ben_intro_body()}
    </p>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-200">
      {m.docs_ibkr_w8ben_why_title()}
    </h2>
    <!-- eslint-disable svelte/no-at-html-tags -- Paraglide messages are compile-time constants -->
    <p class="text-slate-700 dark:text-slate-300">
      {@html m.docs_ibkr_w8ben_why_body()}
    </p>
    <!-- eslint-enable svelte/no-at-html-tags -->
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-200">
      {m.docs_ibkr_w8ben_detect_title()}
    </h2>
    <p class="text-slate-700 dark:text-slate-300">
      {m.docs_ibkr_w8ben_detect_body()}
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
    </p>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-200">
      {m.docs_ibkr_w8ben_links_title()}
    </h2>
    <ul class="list-disc space-y-2 pl-6 text-slate-700 dark:text-slate-300">
      <li>
        <a
          href={irsFormUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="text-blue-600 hover:underline dark:text-blue-400"
        >
          {m.docs_ibkr_w8ben_links_irs()}
        </a>
      </li>
    </ul>
  </section>
</div>
