<script lang="ts">
  import { m } from '$lib/paraglide/messages';
  import { pageTitle } from '$lib/state/page-title.svelte';

  $effect(() => {
    pageTitle.set(m.nav_faq());
  });

  const faqs = [
    {
      question: m.faq_01_question,
      answer: m.faq_01_answer,
    },
    {
      question: m.faq_02_question,
      answer: m.faq_02_answer,
    },
    {
      question: m.faq_03_question,
      answer: m.faq_03_answer,
    },
    {
      question: m.faq_04_question,
      answer: m.faq_04_answer,
    },
    {
      question: m.faq_05_question,
      answer: m.faq_05_answer,
    },
    {
      question: m.faq_06_question,
      answer: m.faq_06_answer,
    },
    {
      question: m.faq_07_question,
      answer: m.faq_07_answer,
    },
    {
      question: m.faq_08_question,
      answer: m.faq_08_answer,
    },
    {
      question: m.faq_09_question,
      answer: m.faq_09_answer,
    },
    {
      question: m.faq_10_question,
      answer: m.faq_10_answer,
    },
    {
      question: m.faq_11_question,
      answer: m.faq_11_answer,
    },
  ];

  const jsonLd = {
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
  <script type="application/ld+json">
    {@html JSON.stringify(jsonLd)}
  </script>
</svelte:head>

<div class="space-y-4">
  <h1 class="text-3xl font-bold">{m.nav_faq()}</h1>

  {#each faqs as { question, answer }}
    <details class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <summary class="cursor-pointer text-lg font-semibold text-slate-900 dark:text-slate-100">
        {@html question()}
      </summary>
      <p class="mt-3 text-slate-700 dark:text-slate-300">{@html answer()}</p>
    </details>
  {/each}
</div>