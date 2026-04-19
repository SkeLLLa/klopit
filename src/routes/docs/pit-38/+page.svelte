<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { localizeHref } from '$lib/paraglide/runtime';
  import { pageTitle } from '$lib/state/page-title.svelte.js';
  import { ArrowRight, ExternalLink } from 'lucide-svelte';

  pageTitle.set(m.page_pit38());

  const filingYear = new Date().getFullYear() - 1;
  const deadline = `30.04.${filingYear + 1}`;
  const yearStr = String(filingYear);

  const linkClass =
    'font-semibold text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400';

  function linkify(msg: string, href: string): string {
    return msg.replace('<a>', `<a href="${href}" class="${linkClass}">`);
  }

  const steps = [
    { msg: m.page_pit38_sec5_step1(), href: localizeHref('/data') },
    { msg: m.page_pit38_sec5_step2(), href: localizeHref('/rates') },
    { msg: m.page_pit38_sec5_step3(), href: localizeHref('/prior-losses') },
    { msg: m.page_pit38_sec5_step4(), href: localizeHref('/dashboard') },
    { msg: m.page_pit38_sec5_step5(), href: localizeHref('/tax-form') },
  ];

  const externalLinks = [
    {
      href: 'https://www.podatki.gov.pl/pit/formularze-do-druku-pit/',
      title: m.page_pit38_sec6_link1_title(),
      desc: m.page_pit38_sec6_link1_desc(),
    },
    {
      href: 'https://www.podatki.gov.pl/pit/e-deklaracje-pit/',
      title: m.page_pit38_sec6_link2_title(),
      desc: m.page_pit38_sec6_link2_desc(),
    },
    {
      href: 'https://www.podatki.gov.pl/pit/',
      title: m.page_pit38_sec6_link3_title(),
      desc: m.page_pit38_sec6_link3_desc(),
    },
  ];
</script>

<article class="space-y-8">
  <header class="space-y-3">
    <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
      {m.page_pit38_h1()}
    </h1>
    <p class="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
      {m.page_pit38_intro()}
    </p>
  </header>

  <section id="co-to-jest" class="space-y-3 scroll-mt-20">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {m.page_pit38_sec1_title()}
    </h2>
    <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- i18n message, compile-time constant -->
      {@html m.page_pit38_sec1_body()}
    </p>
  </section>

  <section id="kto-sklada" class="space-y-3 scroll-mt-20">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {m.page_pit38_sec2_title()}
    </h2>
    <ul class="list-disc space-y-2 pl-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      <li>{m.page_pit38_sec2_b1()}</li>
      <li>{m.page_pit38_sec2_b2()}</li>
      <li>{m.page_pit38_sec2_b3()}</li>
      <li>{m.page_pit38_sec2_b4()}</li>
    </ul>
  </section>

  <section id="terminy" class="space-y-3 scroll-mt-20">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {m.page_pit38_sec3_title({ year: yearStr })}
    </h2>
    <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- i18n message, compile-time constant -->
      {@html m.page_pit38_sec3_body({ year: yearStr, deadline })}
    </p>
  </section>

  <section id="sekcje" class="space-y-3 scroll-mt-20">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {m.page_pit38_sec4_title()}
    </h2>
    <!-- eslint-disable svelte/no-at-html-tags -- i18n messages, compile-time constants -->
    <ul class="list-disc space-y-2 pl-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      <li>{@html m.page_pit38_sec4_c()}</li>
      <li>{@html m.page_pit38_sec4_d()}</li>
      <li>{@html m.page_pit38_sec4_g()}</li>
      <li>{@html m.page_pit38_sec4_pitzg()}</li>
    </ul>
    <!-- eslint-enable svelte/no-at-html-tags -->
  </section>

  <section id="instrukcja" class="space-y-3 scroll-mt-20">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {m.page_pit38_sec5_title()}
    </h2>
    <ol
      class="list-decimal space-y-2 pl-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300"
    >
      {#each steps as step, i (i)}
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- i18n message, compile-time constant -->
        <li>{@html linkify(step.msg, step.href)}</li>
      {/each}
    </ol>
  </section>

  <section id="druk" class="space-y-3 scroll-mt-20">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {m.page_pit38_sec6_title()}
    </h2>
    <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- i18n message, compile-time constant -->
      {@html m.page_pit38_sec6_intro()}
    </p>
    <div class="grid gap-3 sm:grid-cols-2">
      {#each externalLinks as link (link.href)}
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          class="group flex gap-3 rounded-lg border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-emerald-600 dark:hover:bg-emerald-500/10"
        >
          <ExternalLink
            size={18}
            class="mt-0.5 shrink-0 text-slate-400 transition-colors group-hover:text-emerald-500 dark:text-slate-500"
          />
          <div>
            <span class="block text-sm font-semibold text-slate-900 dark:text-slate-100">
              {link.title}
            </span>
            <span class="mt-1 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {link.desc}
            </span>
          </div>
        </a>
      {/each}
    </div>
  </section>

  <section
    id="online"
    class="space-y-3 scroll-mt-20 rounded-xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-500/25 dark:bg-emerald-500/10"
  >
    <h2 class="text-xl font-semibold text-emerald-900 dark:text-emerald-200">
      {m.page_pit38_sec7_title()}
    </h2>
    <p class="text-sm leading-relaxed text-emerald-900/80 dark:text-emerald-200/80">
      {m.page_pit38_sec7_body()}
    </p>
    <a
      href={localizeHref('/data')}
      class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
    >
      {m.page_pit38_sec7_cta()}
      <ArrowRight size={12} />
    </a>
  </section>

  <section id="podstawa-prawna" class="space-y-3 scroll-mt-20">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
      {m.page_pit38_sec8_title()}
    </h2>
    <ul class="list-disc space-y-2 pl-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      <li>{m.page_pit38_sec8_item1()}</li>
      <li>{m.page_pit38_sec8_item2()}</li>
      <li>{m.page_pit38_sec8_item3()}</li>
      <li>{m.page_pit38_sec8_item4()}</li>
    </ul>
  </section>
</article>
