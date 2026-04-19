<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { localizeHref } from '$lib/paraglide/runtime';
  import { pageTitle } from '$lib/state/page-title.svelte.js';
  import { ArrowRight } from 'lucide-svelte';

  pageTitle.set(m.page_docs_ib());
</script>

<div class="space-y-6">
  <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
    {m.page_docs_ib()}
  </h1>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-200">
      {m.docs_ib_export_title()}
    </h2>
    <!-- eslint-disable svelte/no-at-html-tags -- i18n messages are compile-time constants from Paraglide, not user input -->
    <ol class="list-decimal space-y-2 pl-6 text-slate-700 dark:text-slate-300">
      <li>{@html m.docs_ib_step1()}</li>
      <li>{@html m.docs_ib_step2()}</li>
      <li>{@html m.docs_ib_step3()}</li>
      <li>{@html m.docs_ib_step4()}</li>
      <li>{@html m.docs_ib_step5()}</li>
    </ol>
    <!-- eslint-enable svelte/no-at-html-tags -->
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-200">
      {m.docs_ib_tips_title()}
    </h2>
    <ul class="list-disc space-y-2 pl-6 text-slate-700 dark:text-slate-300">
      <li>{m.docs_ib_tip1()}</li>
      <li>{m.docs_ib_tip2()}</li>
    </ul>
  </section>

  <a
    href={localizeHref('/docs/ibkr/w8ben')}
    class="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 transition hover:bg-blue-100 dark:border-blue-500/40 dark:bg-blue-500/10 dark:hover:bg-blue-500/20"
  >
    <div>
      <div class="text-sm font-semibold text-blue-900 dark:text-blue-100">
        {m.nav_docs_ibkr_w8ben()}
      </div>
      <div class="text-xs text-blue-800/80 dark:text-blue-200/80">
        {m.page_docs_ibkr_w8ben()}
      </div>
    </div>
    <ArrowRight size={16} class="text-blue-600 dark:text-blue-400" />
  </a>

  <!-- eslint-disable svelte/no-at-html-tags -->
  <p class="border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
    {@html m.docs_more_brokers_coming()}
  </p>
  <!-- eslint-enable svelte/no-at-html-tags -->
</div>
