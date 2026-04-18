<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { Upload, CheckCircle2, FileText } from 'lucide-svelte';

  const steps = [
    { n: 1, icon: Upload, title: m.home_how_step1_title(), desc: m.home_how_step1_desc() },
    { n: 2, icon: CheckCircle2, title: m.home_how_step2_title(), desc: m.home_how_step2_desc() },
    { n: 3, icon: FileText, title: m.home_how_step3_title(), desc: m.home_how_step3_desc() },
  ];

  const jsonLd = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: m.home_how_title(),
    step: steps.map((s) => ({
      '@type': 'HowToStep',
      position: s.n,
      name: s.title,
      text: s.desc,
    })),
  })}${'</'}script>`;
</script>

<svelte:head>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- JSON-LD structured data -->
  {@html jsonLd}
</svelte:head>

<section aria-labelledby="how-it-works" class="mb-5">
  <h2
    id="how-it-works"
    class="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100"
  >
    {m.home_how_title()}
  </h2>
  <ol class="grid grid-cols-1 gap-3 sm:grid-cols-3">
    {#each steps as s (s.n)}
      <li
        class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-white/[0.03]"
      >
        <div class="mb-2 flex items-center gap-2">
          <div
            class="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-500/12"
          >
            <s.icon size={14} class="text-emerald-500 dark:text-emerald-400" />
          </div>
          <span class="text-xs font-semibold text-slate-900 dark:text-slate-100"
            >{s.n}. {s.title}</span
          >
        </div>
        <p class="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{s.desc}</p>
      </li>
    {/each}
  </ol>
</section>
