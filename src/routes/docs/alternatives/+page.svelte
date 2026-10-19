<script lang="ts">
  import { m } from '#lib/paraglide/messages.js';
  import { localizeHref } from '#lib/paraglide/runtime.js';
  import { pageTitle } from '#lib/state/page-title.svelte.js';
  import { ArrowRight } from '@lucide/svelte';

  pageTitle.set(m.page_docs_alternatives());

  const columns = [
    m.docs_alt_col_sheet,
    m.docs_alt_col_advisor,
    m.docs_alt_col_broker,
    m.docs_alt_col_online,
    m.docs_alt_col_klopit,
  ];

  const rows = [
    [
      m.docs_alt_r1_name,
      m.docs_alt_r1_sheet,
      m.docs_alt_r1_advisor,
      m.docs_alt_r1_broker,
      m.docs_alt_r1_online,
      m.docs_alt_r1_klopit,
    ],
    [
      m.docs_alt_r2_name,
      m.docs_alt_r2_sheet,
      m.docs_alt_r2_advisor,
      m.docs_alt_r2_broker,
      m.docs_alt_r2_online,
      m.docs_alt_r2_klopit,
    ],
    [
      m.docs_alt_r3_name,
      m.docs_alt_r3_sheet,
      m.docs_alt_r3_advisor,
      m.docs_alt_r3_broker,
      m.docs_alt_r3_online,
      m.docs_alt_r3_klopit,
    ],
    [
      m.docs_alt_r4_name,
      m.docs_alt_r4_sheet,
      m.docs_alt_r4_advisor,
      m.docs_alt_r4_broker,
      m.docs_alt_r4_online,
      m.docs_alt_r4_klopit,
    ],
    [
      m.docs_alt_r5_name,
      m.docs_alt_r5_sheet,
      m.docs_alt_r5_advisor,
      m.docs_alt_r5_broker,
      m.docs_alt_r5_online,
      m.docs_alt_r5_klopit,
    ],
    [
      m.docs_alt_r6_name,
      m.docs_alt_r6_sheet,
      m.docs_alt_r6_advisor,
      m.docs_alt_r6_broker,
      m.docs_alt_r6_online,
      m.docs_alt_r6_klopit,
    ],
  ];
</script>

<div class="space-y-6">
  <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
    {m.page_docs_alternatives()}
  </h1>

  <p class="text-slate-700 dark:text-slate-300">{m.docs_alt_intro()}</p>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-200">
      {m.docs_alt_table_title()}
    </h2>
    <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table class="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-700">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <tr>
            <th class="px-4 py-3">{m.docs_alt_col_criterion()}</th>
            {#each columns as column (column)}
              <th class="px-4 py-3">{column()}</th>
            {/each}
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900/40">
          {#each rows as row (row[0])}
            <tr class="align-top">
              {#each row as cell, index (cell)}
                <td
                  class={index === 0
                    ? 'px-4 py-3 font-medium text-slate-900 dark:text-slate-100'
                    : 'px-4 py-3 text-slate-700 dark:text-slate-300'}
                >
                  {cell()}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-200">
      {m.docs_alt_limits_title()}
    </h2>
    <ul class="list-disc space-y-2 pl-6 text-slate-700 dark:text-slate-300">
      <li>{m.docs_alt_limit1()}</li>
      <li>{m.docs_alt_limit2()}</li>
      <li>{m.docs_alt_limit3()}</li>
      <li>{m.docs_alt_limit4()}</li>
    </ul>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-200">
      {m.docs_alt_choose_title()}
    </h2>
    <ul class="list-disc space-y-2 pl-6 text-slate-700 dark:text-slate-300">
      <li>{m.docs_alt_choose1()}</li>
      <li>{m.docs_alt_choose2()}</li>
      <li>{m.docs_alt_choose3()}</li>
      <li>{m.docs_alt_choose4()}</li>
    </ul>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-200">
      {m.docs_related_title()}
    </h2>
    <a
      href={localizeHref('/docs/brokers')}
      class="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 transition hover:bg-blue-100 dark:border-blue-500/40 dark:bg-blue-500/10 dark:hover:bg-blue-500/20"
    >
      <div>
        <div class="text-sm font-semibold text-blue-900 dark:text-blue-100">
          {m.docs_alt_link_brokers()}
        </div>
        <div class="text-xs text-blue-800/80 dark:text-blue-200/80">
          {m.docs_alt_link_brokers_desc()}
        </div>
      </div>
      <ArrowRight size={16} class="text-blue-600 dark:text-blue-400" />
    </a>
  </section>
</div>
