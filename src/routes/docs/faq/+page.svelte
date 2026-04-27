<script lang="ts">
  import { m } from '$lib/paraglide/messages';
  import { pageTitle } from '$lib/state/page-title.svelte';

  pageTitle.set(m.nav_faq());

  const faqs = [
    {
      id: 'what-is-klopit',
      question: m.faq_01_question,
      answer: m.faq_01_answer,
    },
    {
      id: 'tax-filing',
      question: m.faq_02_question,
      answer: m.faq_02_answer,
    },
    {
      id: 'privacy',
      question: m.faq_03_question,
      answer: m.faq_03_answer,
    },
    {
      id: 'brokers',
      question: m.faq_04_question,
      answer: m.faq_04_answer,
    },
    {
      id: 'nbp-rates',
      question: m.faq_05_question,
      answer: m.faq_05_answer,
    },
    {
      id: 'fifo',
      question: m.faq_06_question,
      answer: m.faq_06_answer,
    },
    {
      id: 'pln-conversion',
      question: m.faq_07_question,
      answer: m.faq_07_answer,
    },
    {
      id: 'withholding-tax',
      question: m.faq_08_question,
      answer: m.faq_08_answer,
    },
    {
      id: 'pit38-pitzg',
      question: m.faq_09_question,
      answer: m.faq_09_answer,
    },
    {
      id: 'rounding',
      question: m.faq_10_question,
      answer: m.faq_10_answer,
    },
    {
      id: 'placeholders',
      question: m.faq_11_question,
      answer: m.faq_11_answer,
    },
    {
      id: 'capital-loss',
      question: m.faq_12_question,
      answer: m.faq_12_answer,
    },
  ];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- used in svelte:head template
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question(),
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer(),
      },
    })),
  };
</script>

<svelte:head>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- JSON-LD structured data from compile-time i18n, not user input -->
  <script type="application/ld+json">
    {@html JSON.stringify(jsonLd)}
  </script>
</svelte:head>

<div class="space-y-4">
  <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">{m.nav_faq()}</h1>

  <!-- eslint-disable svelte/no-at-html-tags -- i18n messages are compile-time constants from Paraglide, not user input -->
  {#each faqs as { id, question, answer } (id)}
    <details
      {id}
      class="scroll-mt-20 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
    >
      <summary class="cursor-pointer text-lg font-semibold text-slate-900 dark:text-slate-100">
        {@html question()}
      </summary>
      <p class="mt-3 text-slate-700 dark:text-slate-300">{@html answer()}</p>
    </details>
  {/each}
  <!-- eslint-enable svelte/no-at-html-tags -->
</div>
