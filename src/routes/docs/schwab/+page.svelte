<script lang="ts">
  import { m } from '#lib/paraglide/messages.js';
  import { localizeHref } from '#lib/paraglide/runtime.js';
  import { pageTitle } from '#lib/state/page-title.svelte.js';
  import { ArrowRight } from '@lucide/svelte';

  pageTitle.set(m.page_docs_schwab());
</script>

<div class="space-y-6">
  <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
    {m.page_docs_schwab()}
  </h1>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-200">
      {m.docs_schwab_import_title()}
    </h2>
    <ul class="list-disc space-y-2 pl-6 text-slate-700 dark:text-slate-300">
      <li>{@html m.docs_schwab_li1()}</li>
      <li>{@html m.docs_schwab_li2()}</li>
      <li>{@html m.docs_schwab_li3()}</li>
      <li>{@html m.docs_schwab_li4()}</li>
    </ul>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-200">
      {m.docs_schwab_steps_title()}
    </h2>
    <ol class="list-decimal space-y-2 pl-6 text-slate-700 dark:text-slate-300">
      <li>{@html m.docs_schwab_step1()}</li>
      <li>{@html m.docs_schwab_step2()}</li>
      <li>{@html m.docs_schwab_step3()}</li>
      <li>{@html m.docs_schwab_step4()}</li>
    </ol>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-200">
      {m.docs_schwab_tips_title()}
    </h2>
    <ul class="list-disc space-y-2 pl-6 text-slate-700 dark:text-slate-300">
      <li>{@html m.docs_schwab_tip1()}</li>
      <li>{@html m.docs_schwab_tip2()}</li>
      <li>{@html m.docs_schwab_tip3()}</li>
      <li>{@html m.docs_schwab_tip4()}</li>
      <li>{@html m.docs_schwab_tip5()}</li>
    </ul>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-200">
      {m.docs_related_title()}
    </h2>
    <a
      href={localizeHref('/docs/ibi/espp')}
      class="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 transition hover:bg-blue-100 dark:border-blue-500/40 dark:bg-blue-500/10 dark:hover:bg-blue-500/20"
    >
      <div>
        <div class="text-sm font-semibold text-blue-900 dark:text-blue-100">
          {m.docs_schwab_link_espp()}
        </div>
        <div class="text-xs text-blue-800/80 dark:text-blue-200/80">
          {m.docs_schwab_link_desc_espp()}
        </div>
      </div>
      <ArrowRight size={16} class="text-blue-600 dark:text-blue-400" />
    </a>
    <a
      href={localizeHref('/docs/ibi/rsu')}
      class="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 transition hover:bg-blue-100 dark:border-blue-500/40 dark:bg-blue-500/10 dark:hover:bg-blue-500/20"
    >
      <div>
        <div class="text-sm font-semibold text-blue-900 dark:text-blue-100">
          {m.docs_schwab_link_rsu()}
        </div>
        <div class="text-xs text-blue-800/80 dark:text-blue-200/80">
          {m.docs_schwab_link_desc_rsu()}
        </div>
      </div>
      <ArrowRight size={16} class="text-blue-600 dark:text-blue-400" />
    </a>
    <a
      href={localizeHref('/docs/dividends/us-15-or-19')}
      class="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 transition hover:bg-blue-100 dark:border-blue-500/40 dark:bg-blue-500/10 dark:hover:bg-blue-500/20"
    >
      <div>
        <div class="text-sm font-semibold text-blue-900 dark:text-blue-100">
          {m.docs_schwab_link_div()}
        </div>
        <div class="text-xs text-blue-800/80 dark:text-blue-200/80">
          {m.docs_schwab_link_desc_div()}
        </div>
      </div>
      <ArrowRight size={16} class="text-blue-600 dark:text-blue-400" />
    </a>
  </section>
</div>
