<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { localizeHref } from '$lib/paraglide/runtime';
  import { HelpCircle, ArrowRight } from 'lucide-svelte';

  const questions = [
    { text: m.home_faq_teaser_q1(), hash: 'capital-loss' },
    { text: m.home_faq_teaser_q2(), hash: 'nbp-rates' },
    { text: m.home_faq_teaser_q3(), hash: 'pit38-pitzg' },
  ];
</script>

<section aria-labelledby="faq-teaser" class="mb-5">
  <h2
    id="faq-teaser"
    class="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100"
  >
    {m.home_faq_teaser_title()}
  </h2>
  <ul class="space-y-2">
    {#each questions as q (q.hash)}
      <li>
        <a
          href={`${localizeHref('/docs/faq')}#${q.hash}`}
          class="group flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 transition hover:border-emerald-300 hover:text-emerald-600 dark:border-slate-800 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:border-emerald-500/45"
        >
          <span class="flex items-center gap-2">
            <HelpCircle size={12} class="text-emerald-500 dark:text-emerald-400" />
            {q.text}
          </span>
          <ArrowRight size={12} class="text-slate-400 transition group-hover:translate-x-0.5" />
        </a>
      </li>
    {/each}
  </ul>
</section>
