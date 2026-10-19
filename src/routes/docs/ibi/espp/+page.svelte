<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { pageTitle } from '$lib/state/page-title.svelte.js';

  pageTitle.set(m.page_docs_ibi_espp());
</script>

<div class="space-y-6">
  <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
    {m.page_docs_ibi_espp()}
  </h1>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-200">
      {m.docs_ibi_export_title()}
    </h2>
    <ol class="list-decimal space-y-2 pl-6 text-slate-700 dark:text-slate-300">
      <li>{@html m.docs_ibi_step1()}</li>
      <li>{@html m.docs_ibi_step2()}</li>
      <li>{@html m.docs_ibi_step3()}</li>
      <li>{@html m.docs_ibi_step4()}</li>
    </ol>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-200">
      {m.docs_ib_tips_title()}
    </h2>
    <ul class="list-disc space-y-2 pl-6 text-slate-700 dark:text-slate-300">
      <li>{@html m.docs_ibi_tip1()}</li>
      <li>{@html m.docs_ibi_tip2()}</li>
    </ul>
  </section>
</div>
