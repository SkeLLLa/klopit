<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { localizeHref } from '$lib/paraglide/runtime';
  import { pageTitle } from '$lib/state/page-title.svelte.js';
  import {
    ArrowRight,
    BarChart3,
    CalendarClock,
    Eye,
    FileText,
    Lock,
    Table,
    Upload,
  } from 'lucide-svelte';
  import GitHubIcon from '$lib/components/ui/GitHubIcon.svelte';
  import WhyPillars from '$lib/components/home/WhyPillars.svelte';
  import HowItWorks from '$lib/components/home/HowItWorks.svelte';
  import FaqTeaser from '$lib/components/home/FaqTeaser.svelte';

  pageTitle.set(m.nav_home());

  const filingYear = new Date().getFullYear() - 1;
  const deadline = `30.04.${filingYear + 1}`;
  const deadlineLine = m.home_trust_deadline({ year: String(filingYear), deadline });

  const featureCards = [
    {
      href: '/data',
      title: m.home_feature_csv_title(),
      description: m.home_feature_csv_desc(),
      icon: Upload,
    },
    {
      href: '/rates',
      title: m.home_feature_fifo_title(),
      description: m.home_feature_fifo_desc(),
      icon: Table,
    },
    {
      href: '/dashboard',
      title: m.home_feature_transparency_title(),
      description: m.home_feature_transparency_desc(),
      icon: Eye,
    },
    {
      href: '/dashboard',
      title: m.home_feature_dashboard_title(),
      description: m.home_feature_dashboard_desc(),
      icon: BarChart3,
    },
    {
      href: '/tax-form',
      title: m.home_feature_pit38_title(),
      description: m.home_feature_pit38_desc(),
      icon: FileText,
    },
    {
      href: 'https://github.com/SkeLLLa/klopit',
      title: m.home_github_title(),
      description: m.about_card_repo_desc(),
      icon: GitHubIcon,
    },
    {
      href: null,
      title: m.about_card_security_title(),
      description: m.about_card_security_desc(),
      icon: Lock,
    },
  ] as const;
</script>

<div>
  <h1 class="mb-1 text-3xl font-extrabold text-slate-900 dark:text-slate-100">
    {m.home_welcome()}
  </h1>
  <p
    class="mb-4 border-r-2 border-emerald-300/60 pr-3 text-right text-[11px] italic leading-relaxed text-slate-400 dark:border-emerald-500/30 dark:text-slate-500"
  >
    {m.home_name_origin()}
  </p>
  <p class="mb-5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
    {m.home_description()}
  </p>

  <WhyPillars />

  <section
    aria-labelledby="home-cta-heading"
    class="relative mb-6 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/60 p-6 sm:p-7 dark:border-emerald-500/30 dark:from-emerald-500/15 dark:via-slate-900/30 dark:to-emerald-400/10"
  >
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -top-24 -right-20 h-56 w-56 rounded-full bg-emerald-300/40 blur-3xl dark:bg-emerald-500/20"
    ></div>
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -bottom-28 -left-16 h-56 w-56 rounded-full bg-emerald-200/50 blur-3xl dark:bg-emerald-400/10"
    ></div>

    <div
      class="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8"
    >
      <div class="max-w-xl">
        <span
          class="mb-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/70 bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300"
        >
          <CalendarClock size={11} />
          {deadlineLine}
        </span>
        <h2
          id="home-cta-heading"
          class="mb-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-100"
        >
          {m.home_cta_heading()}
        </h2>
        <p class="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
          {m.home_cta()}
        </p>
      </div>

      <div class="flex flex-col items-start gap-2 sm:items-end">
        <a
          href={localizeHref('/data')}
          class="group inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-600 hover:shadow-emerald-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:shadow-emerald-500/10 dark:focus-visible:ring-offset-slate-900"
        >
          {m.home_cta_primary()}
          <ArrowRight
            size={16}
            class="transition-transform group-hover:translate-x-0.5"
          />
        </a>
        <a
          href={localizeHref('/docs/pit-38')}
          class="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:underline dark:text-emerald-300"
        >
          {m.nav_docs_pit38()}
          <ArrowRight size={11} />
        </a>
      </div>
    </div>
  </section>

  <HowItWorks />

  <section aria-labelledby="home-features" class="mb-5">
    <h2
      id="home-features"
      class="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100"
    >
      {m.home_features_title()}
    </h2>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {#each featureCards as card (card.title)}
      {#if card.href !== null}
        <a
          href={card.href.startsWith('http') ? card.href : localizeHref(card.href)}
          target={card.href.startsWith('http') ? '_blank' : undefined}
          rel={card.href.startsWith('http') ? 'noopener noreferrer' : undefined}
          class="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-white/[0.03] dark:hover:border-emerald-500/45"
        >
          <div class="mb-2 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <div
                class="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-500/12"
              >
                <card.icon size={14} class="text-emerald-500 dark:text-emerald-400" />
              </div>
              <span class="text-xs font-semibold text-slate-900 dark:text-slate-100"
                >{card.title}</span
              >
            </div>
            <ArrowRight
              size={14}
              class="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-500 dark:group-hover:text-emerald-400"
            />
          </div>
          <p class="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {card.description}
          </p>
        </a>
      {:else}
        <div
          class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-white/[0.03]"
        >
          <div class="mb-2 flex items-center gap-2">
            <div
              class="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-500/12"
            >
              <card.icon size={14} class="text-emerald-500 dark:text-emerald-400" />
            </div>
            <span class="text-xs font-semibold text-slate-900 dark:text-slate-100">{card.title}</span>
          </div>
          <p class="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {card.description}
          </p>
        </div>
      {/if}
      {/each}
    </div>
  </section>

  <FaqTeaser />
</div>
