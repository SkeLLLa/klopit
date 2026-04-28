<script lang="ts">
  import { m } from '$lib/paraglide/messages';
  import { pageTitle } from '$lib/state/page-title.svelte';
  import { FAQ_ITEMS } from '$lib/constants/faq.js';
  import { ChevronDown } from 'lucide-svelte';

  pageTitle.set(m.nav_faq());

  const faqs = FAQ_ITEMS.map((faq) => ({
    id: faq.id,
    question: m[faq.questionKey],
    answer: m[faq.answerKey],
  }));
</script>

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
          </p>
        </div>
      </details>
    {/each}
    <!-- eslint-enable svelte/no-at-html-tags -->
  </div>
</div>
