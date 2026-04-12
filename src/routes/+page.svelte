<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { pageTitle } from '$lib/state/page-title.svelte.js';
  import { ArrowRight, BarChart3, FileText, Lock, Table, Upload } from 'lucide-svelte';
  import GitHubIcon from '$lib/components/ui/GitHubIcon.svelte';

  $effect(() => {
    pageTitle.set(m.nav_home());
  });

  const featureCards = [
    {
      href: '/data',
      title: m.home_feature_csv_title(),
      description: m.home_feature_csv_desc(),
      icon: Upload
    },
    {
      href: '/rates',
      title: m.home_feature_fifo_title(),
      description: m.home_feature_fifo_desc(),
      icon: Table
    },
    {
      href: '/dashboard',
      title: m.home_feature_dashboard_title(),
      description: m.home_feature_dashboard_desc(),
      icon: BarChart3
    },
    {
      href: '/tax-form',
      title: m.home_feature_pit38_title(),
      description: m.home_feature_pit38_desc(),
      icon: FileText
    },
    {
      href: 'https://github.com/SkeLLLa/klopit',
      title: m.home_github_title(),
      description: m.about_card_repo_desc(),
      icon: GitHubIcon
    },
    {
      href: null,
      title: m.about_card_security_title(),
      description: m.about_card_security_desc(),
      icon: Lock
    }
  ] as const;
</script>

<div>
  <h1 class="mb-4 text-3xl font-extrabold text-slate-900 dark:text-slate-100">
    {m.home_welcome()}
  </h1>
  <p class="mb-5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
    {m.home_description()}
  </p>

  <div class="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
    {#each featureCards as card (card.title)}
      {#if card.href !== null}
        <a
          href={card.href}
          target={card.href.startsWith('http') ? '_blank' : undefined}
          rel={card.href.startsWith('http') ? 'noopener noreferrer' : undefined}
          class="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-white/[0.03] dark:hover:border-emerald-500/45"
        >
          <div class="mb-2 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <div class="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-500/12">
                <card.icon size={14} class="text-emerald-500 dark:text-emerald-400" />
              </div>
              <span class="text-xs font-semibold text-slate-900 dark:text-slate-100">{card.title}</span>
            </div>
            <ArrowRight size={14} class="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-500 dark:group-hover:text-emerald-400" />
          </div>
          <p class="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{card.description}</p>
        </a>
      {:else}
        <div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-white/[0.03]">
          <div class="mb-2 flex items-center gap-2">
            <div class="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-500/12">
              <card.icon size={14} class="text-emerald-500 dark:text-emerald-400" />
            </div>
            <span class="text-xs font-semibold text-slate-900 dark:text-slate-100">{card.title}</span>
          </div>
          <p class="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{card.description}</p>
        </div>
      {/if}
    {/each}
  </div>

  <div class="flex items-center gap-2.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3.5 dark:border-emerald-500/25 dark:bg-emerald-500/12">
    <span class="text-xs font-medium text-emerald-600 dark:text-emerald-400">{m.home_cta()}</span>
  </div>
</div>
