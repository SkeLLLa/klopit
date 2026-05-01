<script lang="ts">
  import GroundingLinks from '$lib/components/docs/GroundingLinks.svelte';
  import LegalClaim from '$lib/components/docs/LegalClaim.svelte';
  import { pageTitle } from '$lib/state/page-title.svelte.js';
  import { localizeHref } from '$lib/paraglide/runtime';
  import { ArrowRight } from 'lucide-svelte';

  let { data } = $props();

  const content = $derived(data.content);

  $effect(() => {
    pageTitle.set(content.pageTitle);
  });
</script>

{#snippet citations(keys: string[])}
  <GroundingLinks sources={content.sources} {keys} />
{/snippet}

<article class="space-y-8">
  <header class="space-y-4">
    <p class="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
      {content.updatedLabel}
    </p>
    <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
      {content.h1}
    </h1>
    <LegalClaim body={content.intro} sources={content.sources} keys={['art30a', 'usTreaty']} />
    <a
      href={localizeHref('/data')}
      class="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
    >
      {content.cta}
      <ArrowRight size={15} />
    </a>
  </header>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {content.decisionTitle}
    </h2>
    <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table class="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-700">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <tr>
            {#each content.decisionHeaders as header (header)}
              <th class="px-4 py-3">{header}</th>
            {/each}
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900/40">
          {#each content.scenarios as row (row.name)}
            <tr>
              <td class="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{row.name}</td>
              <td class="px-4 py-3 text-slate-700 dark:text-slate-300">{row.wht}</td>
              <td class="px-4 py-3 text-slate-700 dark:text-slate-300">{row.credit}</td>
              <td class="px-4 py-3 text-slate-700 dark:text-slate-300">{row.tax}</td>
              <td class="px-4 py-3 text-slate-600 dark:text-slate-400">{row.action}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {content.exampleTitle}
    </h2>
    <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {content.exampleBody}
      {@render citations(['art11a'])}
    </p>
    <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table class="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-700">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <tr>
            {#each content.exampleHeaders as header (header)}
              <th class="px-4 py-3">{header}</th>
            {/each}
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900/40">
          {#each content.exampleRows as row, index (`${index}-${row[0]}`)}
            <tr>
              <td class="px-4 py-3 text-slate-700 dark:text-slate-300">{index + 1}. {row[0]}</td>
              <td class="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{row[1]}</td>
              <td class="px-4 py-3 text-slate-600 dark:text-slate-400">{row[2]}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {content.exampleConclusion}
    </p>
  </section>

  <section class="space-y-4">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {content.faqTitle}
    </h2>
    <div class="space-y-3">
      {#each content.faqPairs as item, index (item.q)}
        <details class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <summary class="cursor-pointer text-sm font-semibold text-slate-900 dark:text-slate-100">
            {item.q}
          </summary>
          <p class="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {item.a}
            {#if index === 0 || index === 1}
              {@render citations(['art30a', 'usTreaty'])}
            {:else if index === 3}
              {@render citations(['art11a'])}
            {:else if index === 4}
              {@render citations(['w8ben'])}
            {/if}
          </p>
        </details>
      {/each}
    </div>
  </section>

  <section class="grid gap-3 sm:grid-cols-3">
    {#each content.relatedLinks as link (link.href)}
      <a
        href={localizeHref(link.href)}
        class="rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-900 transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-emerald-600 dark:hover:bg-emerald-500/10"
      >
        {link.label}
      </a>
    {/each}
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {content.sourcesTitle}
    </h2>
    <GroundingLinks sources={content.sources} variant="list" />
  </section>
</article>
