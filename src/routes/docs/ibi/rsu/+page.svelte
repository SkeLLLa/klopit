<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { pageTitle } from '$lib/state/page-title.svelte.js';

  pageTitle.set(m.page_docs_ibi_rsu());
</script>

<div class="space-y-6">
  <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
    {m.page_docs_ibi_rsu()}
  </h1>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-200">
      {m.docs_ibi_rsu_export_title()}
    </h2>
    <!-- eslint-disable svelte/no-at-html-tags -- i18n messages are compile-time constants from Paraglide, not user input -->
    <ol class="list-decimal space-y-2 pl-6 text-slate-700 dark:text-slate-300">
      <li>{@html m.docs_ibi_rsu_step1()}</li>
      <li>{@html m.docs_ibi_rsu_step2()}</li>
      <li>{@html m.docs_ibi_rsu_step3()}</li>
      <li>{@html m.docs_ibi_rsu_step4()}</li>
    </ol>
    <!-- eslint-enable svelte/no-at-html-tags -->
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-200">
      {m.docs_ib_tips_title()}
    </h2>
    <!-- eslint-disable svelte/no-at-html-tags -- i18n messages are compile-time constants from Paraglide, not user input -->
    <ul class="list-disc space-y-2 pl-6 text-slate-700 dark:text-slate-300">
      <li>{@html m.docs_ibi_rsu_tip1()}</li>
      <li>{@html m.docs_ibi_rsu_tip2()}</li>
    </ul>
    <!-- eslint-enable svelte/no-at-html-tags -->
  </section>
</div>
