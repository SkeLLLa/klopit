<script lang="ts">
  import GroundingLinks from '$lib/components/docs/GroundingLinks.svelte';
  import type { GroundingSource } from '$lib/components/docs/grounding';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { pageTitle } from '$lib/state/page-title.svelte';
  import { FAQ_ITEMS } from '$lib/constants/faq.js';
  import { ChevronDown } from 'lucide-svelte';

  pageTitle.set(m.nav_faq());

  const sourcesTitle = {
    en: 'Sources',
    pl: 'Źródła',
    uk: 'Джерела',
  }[getLocale()];

  const faqs = FAQ_ITEMS.map((faq) => ({
    id: faq.id,
    question: m[faq.questionKey],
    answer: m[faq.answerKey],
  }));

  const sources: GroundingSource[] = [
    {
      key: 'art11a',
      label: 'Ustawa o PIT, art. 11a',
      href: 'https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-11a/',
      quote: '„z ostatniego dnia roboczego poprzedzającego dzień uzyskania przychodu”',
    },
    {
      key: 'fifo',
      label: 'e-pity - Broszura PIT-8C',
      href: 'https://www.platnik.e-pity.pl/pit8c/broszura-pit8c-opis-pol/',
      quote: '„Rozliczenie przychodów następuje metodą FIFO”',
    },
    {
      key: 'art30a',
      label: 'Ustawa o PIT, art. 30a',
      href: 'https://sip.lex.pl/akty-prawne/dzu-dziennik-ustaw/podatek-dochodowy-od-osob-fizycznych-16794311/art-30-a',
      quote: '„z dywidend ... pobiera się 19%”',
    },
    {
      key: 'art30b',
      label: 'Ustawa o PIT, art. 30b',
      href: 'https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30b/',
      quote: '„podatek dochodowy wynosi 19% uzyskanego dochodu”',
    },
    {
      key: 'ord63',
      label: 'Ordynacja podatkowa, art. 63',
      href: 'https://sip.lex.pl/akty-prawne/dzu-dziennik-ustaw/ordynacja-podatkowa-16799056/art-63',
      quote: '„zaokrągla się do pełnych złotych”',
    },
    {
      key: 'art9',
      label: 'Ustawa o PIT, art. 9 ust. 3',
      href: 'https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-9/',
      quote: '„nie może przekroczyć 50% wysokości tej straty”',
    },
    {
      key: 'pit38Foreign',
      label: 'podatki.gov.pl - PIT-38 i dochody z zagranicy',
      href: 'https://www.podatki.gov.pl/twoj-e-pit/pit-38-za-2025-rok/',
      quote: '„automatycznie dołączy do zeznania załącznik PIT/ZG”',
    },
  ];

  const citationKeysByFaqId: Record<string, string[]> = {
    'nbp-rates': ['art11a'],
    fifo: ['fifo'],
    'pln-conversion': ['art11a'],
    'withholding-tax': ['art30a'],
    'pit38-pitzg': ['art30b', 'art30a', 'pit38Foreign'],
    rounding: ['ord63'],
    'capital-loss': ['art9'],
  };
</script>

{#snippet citations(keys: string[] | undefined)}
  {#if keys?.length}
    <GroundingLinks {sources} {keys} />
  {/if}
{/snippet}

<div class="space-y-6">
  <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">{m.nav_faq()}</h1>

  <div class="space-y-3">
    <!-- eslint-disable svelte/no-at-html-tags -- i18n messages are compile-time constants from Paraglide, not user input -->
    {#each faqs as { id, question, answer } (id)}
      <details
        {id}
        class="group scroll-mt-20 rounded-xl border border-slate-200 bg-white shadow-sm transition-colors hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-emerald-600"
      >
        <summary
          class="group/summary flex cursor-pointer list-none items-center gap-3 rounded-xl p-4 transition-colors hover:bg-emerald-50/50 group-open:rounded-b-none dark:hover:bg-emerald-500/10 [&::-webkit-details-marker]:hidden"
        >
          <span class="min-w-0 flex-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
            {@html question()}
          </span>
          <ChevronDown
            size={16}
            class="shrink-0 text-slate-400 transition-[transform,color] group-open:rotate-180 group-hover/summary:text-emerald-500 dark:text-slate-500"
          />
        </summary>
        <div class="border-t border-slate-100 px-4 pb-4 dark:border-slate-700/50">
          <p class="pt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {@html answer()}
            {@render citations(citationKeysByFaqId[id])}
          </p>
        </div>
      </details>
    {/each}
    <!-- eslint-enable svelte/no-at-html-tags -->
  </div>

  <section class="space-y-3">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {sourcesTitle}
    </h2>
    <GroundingLinks {sources} variant="list" />
  </section>
</div>
