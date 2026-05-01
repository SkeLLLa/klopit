<script lang="ts">
  import GroundingLinks from '$lib/components/docs/GroundingLinks.svelte';
  import LegalClaim from '$lib/components/docs/LegalClaim.svelte';
  import { pageTitle } from '$lib/state/page-title.svelte.js';

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
  <header class="space-y-3">
    <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
      {content.h1}
    </h1>
    <LegalClaim body={content.intro} sources={content.sources} keys={['art17', 'art7']} />
  </header>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {content.behaviorTitle}
    </h2>
    <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {content.behaviorBody}
    </p>
    <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200">
      {content.currentUsageTitle}
    </h3>
    <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table class="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-700">
        <thead
          class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        >
          <tr>
            {#each content.currentUsageHeaders as header (header)}
              <th class="px-4 py-3">{header}</th>
            {/each}
          </tr>
        </thead>
        <tbody
          class="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900/40"
        >
          {#each content.currentUsageRows as row, index (row.area)}
            <tr>
              <td class="px-4 py-3 text-slate-700 dark:text-slate-300">{row.area}</td>
              <td class="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                {row.dateUsed}
              </td>
              <td class="px-4 py-3 text-slate-600 dark:text-slate-400">
                {row.why}
                {#if index === 0 || index === 3}
                  {@render citations(['ibkrStatements'])}
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {content.reasonsIntro}
    </p>
    <ul
      class="list-disc space-y-2 pl-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300"
    >
      {#each content.reasons as reason, index (reason)}
        <li>
          {reason}
          {#if index === 1}
            {@render citations(['art7'])}
          {:else if index === 3}
            {@render citations(['epity'])}
          {:else if index === 4}
            {@render citations(['katowice2009'])}
          {/if}
        </li>
      {/each}
    </ul>
    <div
      class="rounded-lg border-l-4 border-emerald-500 bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200"
    >
      <strong>{content.consistencyTitle}</strong>
      {content.consistencyBody}
    </div>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {content.futureTitle}
    </h2>
    <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {content.futureBody}
    </p>
    <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {content.futureListIntro}
    </p>
    <ul
      class="list-disc space-y-2 pl-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300"
    >
      {#each content.futureReasons as reason, index (reason)}
        <li>
          {reason}
          {#if index === 0}
            {@render citations(['kisPit8c', 'xtbPit8c'])}
          {:else if index === 2}
            {@render citations(['art17', 'art7'])}
          {/if}
        </li>
      {/each}
    </ul>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {content.frameworkTitle}
    </h2>
    <ul
      class="list-disc space-y-2 pl-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300"
    >
      {#each content.frameworkItems as item, index (item)}
        <li>
          {item}
          {#if index === 0 || index === 1 || index === 2}
            {@render citations(['art17'])}
          {:else if index === 3 || index === 4}
            {@render citations(['art7'])}
          {:else if index === 5}
            {@render citations(['siiT2', 'stockwatchT2'])}
          {/if}
        </li>
      {/each}
    </ul>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {content.yearEndTitle}
    </h2>
    <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {content.yearEndIntro}
      {@render citations(['kisYearEnd'])}
    </p>
    <ul
      class="list-disc space-y-2 pl-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300"
    >
      {#each content.yearEndPoints as point, index (point)}
        <li>
          {point}
          {#if index === 0}
            {@render citations(['kisYearEnd', 'art17', 'art7'])}
          {:else if index === 1}
            {@render citations(['katowice2009', 'grant2016'])}
          {:else if index === 2}
            {@render citations(['kisPit8c', 'xtbPit8c'])}
          {/if}
        </li>
      {/each}
    </ul>
    <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {content.yearEndCalendarNote}
      {@render citations(['siiT2'])}
    </p>
    <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table class="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-700">
        <thead
          class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        >
          <tr>
            {#each content.yearEndHeaders as header (header)}
              <th class="px-4 py-3">{header}</th>
            {/each}
          </tr>
        </thead>
        <tbody
          class="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900/40"
        >
          {#each content.yearEndRows as row (row.tradeDate)}
            <tr>
              <td class="px-4 py-3 text-slate-700 dark:text-slate-300">{row.tradeDate}</td>
              <td class="px-4 py-3 text-slate-700 dark:text-slate-300">
                {row.settlementDate}
              </td>
              <td class="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                {row.settlementYear}
              </td>
              <td class="px-4 py-3 text-slate-600 dark:text-slate-400">
                {row.tradeYear}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200">
      {content.yearEndIbkrTitle}
    </h3>
    <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {content.yearEndIbkrBody}
      {@render citations(['ibkrStatements'])}
    </p>
    <div
      class="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
    >
      {content.yearEndWarning}
    </div>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {content.settlementTitle}
    </h2>
    <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200">
      {content.argumentsForTitle}
    </h3>
    <ul
      class="list-disc space-y-2 pl-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300"
    >
      {#each content.settlementFor as argument, index (argument)}
        <li>
          {argument}
          {#if index === 0}
            {@render citations(['art17', 'art7'])}
          {:else if index === 1}
            {@render citations(['grant2016'])}
          {:else if index === 2}
            {@render citations(['kisYearEnd', 'siiT2'])}
          {:else if index === 3}
            {@render citations(['mfShares'])}
          {/if}
        </li>
      {/each}
    </ul>
    <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200">
      {content.argumentsAgainstTitle}
    </h3>
    <ul
      class="list-disc space-y-2 pl-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300"
    >
      {#each content.settlementAgainst as argument, index (argument)}
        <li>
          {argument}
          {#if index === 0}
            {@render citations(['kisYearEnd'])}
          {/if}
        </li>
      {/each}
    </ul>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {content.tradeTitle}
    </h2>
    <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200">
      {content.argumentsForTitle}
    </h3>
    <ul
      class="list-disc space-y-2 pl-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300"
    >
      {#each content.tradeFor as argument, index (argument)}
        <li>
          {argument}
          {#if index === 0}
            {@render citations(['katowice2009'])}
          {:else if index === 1}
            {@render citations(['epity'])}
          {:else if index === 2}
            {@render citations(['kisCit'])}
          {:else if index === 3}
            {@render citations(['ibkrStatements'])}
          {/if}
        </li>
      {/each}
    </ul>
    <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200">
      {content.argumentsAgainstTitle}
    </h3>
    <ul
      class="list-disc space-y-2 pl-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300"
    >
      {#each content.tradeAgainst as argument, index (argument)}
        <li>
          {argument}
          {#if index === 0}
            {@render citations(['grant2016', 'art17'])}
          {:else if index === 1}
            {@render citations(['art7'])}
          {:else if index === 2}
            {@render citations(['kisPit8c', 'xtbPit8c'])}
          {:else if index === 3}
            {@render citations(['nsaEarnout', 'kisEarnout'])}
          {/if}
        </li>
      {/each}
    </ul>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {content.citTitle}
    </h2>
    <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {content.citBody}
      {@render citations(['kisCit'])}
    </p>
    <ul
      class="list-disc space-y-2 pl-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300"
    >
      {#each content.citItems as item, index (item.label)}
        <li>
          <strong>{item.label}</strong>{item.body}
          {#if index === 0}
            {@render citations(['kisCit'])}
          {:else if index === 1}
            {@render citations(['art7'])}
          {/if}
        </li>
      {/each}
    </ul>
    <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {content.citConclusion}
      {@render citations(['kisYearEnd'])}
    </p>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {content.matrixTitle}
    </h2>
    <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table class="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-700">
        <thead
          class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        >
          <tr>
            {#each content.matrixHeaders as header (header)}
              <th class="px-4 py-3">{header}</th>
            {/each}
          </tr>
        </thead>
        <tbody
          class="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900/40"
        >
          {#each content.matrixRows as row, index (row.scenario)}
            <tr>
              <td class="px-4 py-3 text-slate-700 dark:text-slate-300">{row.scenario}</td>
              <td class="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                {row.date}
              </td>
              <td class="px-4 py-3 text-slate-600 dark:text-slate-400">
                {row.why}
                {#if index === 1}
                  {@render citations(['kisPit8c', 'xtbPit8c'])}
                {:else if index === 2}
                  {@render citations(['kisCit'])}
                {:else if index === 3}
                  {@render citations(['nsaEarnout', 'kisEarnout'])}
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {content.bottomLineTitle}
    </h2>
    <ul
      class="list-disc space-y-2 pl-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300"
    >
      {#each content.bottomLine as item, index (item)}
        <li>
          {item}
          {#if index === 2}
            {@render citations(['epity', 'katowice2009', 'kisYearEnd'])}
          {:else if index === 3}
            {@render citations(['ibkrStatements'])}
          {/if}
        </li>
      {/each}
    </ul>
  </section>

  <section class="space-y-3">
    <h2
      id="trade-vs-settlement-sources"
      class="text-xl font-semibold text-slate-900 dark:text-slate-100"
    >
      {content.sourcesTitle}
    </h2>
    <GroundingLinks
      sources={content.sources}
      variant="list"
      labelledBy="trade-vs-settlement-sources"
    />
  </section>

  <p class="text-xs italic text-slate-500 dark:text-slate-400">
    {content.disclaimer}
  </p>
</article>
