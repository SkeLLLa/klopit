<script lang="ts">
  import { localizeHref } from '$lib/paraglide/runtime';
  import { pageTitle } from '$lib/state/page-title.svelte.js';
  import { ArrowRight, CheckCircle2, Clock, FileText, MinusCircle } from 'lucide-svelte';

  let { data } = $props();

  const content = $derived(data.content);

  $effect(() => {
    pageTitle.set(content.pageTitle);
  });
</script>

<article class="space-y-8">
  <header class="space-y-3">
    <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
      {content.h1}
    </h1>
    <p class="max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
      {content.intro}
    </p>
  </header>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {content.importSectionTitle}
    </h2>
    <div class="grid gap-3 md:grid-cols-3">
      {#each data.brokers as broker (broker.id)}
        {@const detail = content.brokerDetails[broker.id]}
        <a
          href={localizeHref(detail.docsHref)}
          class="group rounded-lg border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-emerald-600 dark:hover:bg-emerald-500/10"
        >
          <div class="mb-3 flex items-center justify-between gap-2">
            <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {broker.name}
            </h3>
            {#if detail.status === 'supported'}
              <CheckCircle2 size={16} class="text-emerald-600 dark:text-emerald-400" />
            {:else}
              <Clock size={16} class="text-amber-600 dark:text-amber-400" />
            {/if}
          </div>
          <p class="text-xs font-medium text-slate-700 dark:text-slate-300">
            {detail.importType}
          </p>
          <p class="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {detail.supportedData}
          </p>
          <p class="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 group-hover:underline dark:text-emerald-300">
            {content.docsLabel}
            <ArrowRight size={12} />
          </p>
        </a>
      {/each}
    </div>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {content.featureSectionTitle}
    </h2>
    <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table class="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-700">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <tr>
            {#each content.featureHeaders as header (header)}
              <th class="px-4 py-3">{header}</th>
            {/each}
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900/40">
          {#each content.features as row (row[0])}
            <tr>
              <td class="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                {row[0]}
              </td>
              <td class="px-4 py-3 text-slate-700 dark:text-slate-300">{row[1]}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="grid gap-4 md:grid-cols-2">
    <div class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div class="mb-2 flex items-center gap-2">
        <FileText size={16} class="text-emerald-600 dark:text-emerald-400" />
        <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {content.manualTitle}
        </h2>
      </div>
      <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {content.manualBody}
      </p>
      <a
        href={localizeHref('/data')}
        class="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
      >
        {content.manualCta}
        <ArrowRight size={12} />
      </a>
    </div>

    <div class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div class="mb-2 flex items-center gap-2">
        <MinusCircle size={16} class="text-slate-500 dark:text-slate-400" />
        <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {content.notYetTitle}
        </h2>
      </div>
      <ul class="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
        {#each content.notYet as item (item)}
          <li>{item}</li>
        {/each}
      </ul>
    </div>
  </section>
</article>
