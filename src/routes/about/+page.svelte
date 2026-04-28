<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { localizeHref } from '$lib/paraglide/runtime';
  import { pageTitle } from '$lib/state/page-title.svelte.js';
  import { KLO_ACRONYMS } from '$lib/constants/acronyms.js';
  import GitHubIcon from '$lib/components/ui/GitHubIcon.svelte';
  import { ArrowRight, Bug, FileText, ListChecks, Lock, Scale } from 'lucide-svelte';

  pageTitle.set(m.page_about());

  const githubIssuesLink = 'https://github.com/SkeLLLa/klopit/issues';
  const githubRepoLink = 'https://github.com/SkeLLLa/klopit';
  const githubContributorsLink = 'https://github.com/SkeLLLa/klopit/graphs/contributors';
  const pitlyLink = 'https://github.com/volodymyr-kovtun/Pitly';

  const inspiredParts = $derived.by(() => {
    const text = m.about_inspired_content({ pitlyLink: '{pitlyLink}' });
    const [before, after] = text.split('{pitlyLink}');
    return { before, after: after ?? '' };
  });

  const githubCards = $derived([
    {
      title: m.about_card_repo_title(),
      description: m.about_card_repo_desc(),
      href: githubRepoLink,
      cta: m.about_card_repo_cta(),
      icon: FileText
    },
    {
      title: m.about_card_security_title(),
      description: m.about_card_security_desc(),
      href: '/docs/faq',
      cta: m.about_card_security_cta(),
      icon: Lock
    },
    {
      title: m.about_card_license_title(),
      description: m.about_card_license_desc(),
      href: 'https://github.com/SkeLLLa/klopit/blob/master/LICENSE',
      cta: m.about_card_license_cta(),
      icon: Scale
    },
    {
      title: m.about_card_issues_title(),
      description: m.about_card_issues_desc(),
      href: githubIssuesLink,
      cta: m.about_card_issues_cta(),
      icon: Bug
    }
  ]);
</script>

<div class="space-y-8 max-w-4xl">
  <section>
    <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">
      {m.page_about_h1()}
    </h1>
    <h2 class="mt-5 text-lg font-semibold text-slate-900 dark:text-slate-100">
      {m.about_project_section_title()}
    </h2>
    <p class="mt-4 text-base text-slate-700 dark:text-slate-300 leading-relaxed">
      {m.about_intro()}
    </p>

    <div class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
      <h3 class="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{m.about_name_origin_title()}</h3>
      <p class="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        {m.about_name_origin()}
      </p>
    </div>

    <details class="group mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
      <summary class="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
        <span class="inline-block text-emerald-600 transition group-open:rotate-90 dark:text-emerald-400">&rsaquo;</span>
        {m.about_acronyms_question()}
      </summary>
      <ul class="mt-3 grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3">
        {#each KLO_ACRONYMS as acronym (acronym)}
          <li class="text-xs text-slate-500 dark:text-slate-400">
            <span class="font-semibold text-emerald-600 dark:text-emerald-400">klo</span>PIT &mdash; {acronym}
          </li>
        {/each}
      </ul>
      <a
        href={githubIssuesLink}
        target="_blank"
        rel="noopener noreferrer"
        class="mt-3 inline-block text-xs font-semibold text-emerald-700 underline hover:opacity-80 dark:text-emerald-400"
      >
        {m.about_acronyms_submit()}
      </a>
    </details>
  </section>

  <section
    class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
  >
    <div class="mb-2 flex items-center gap-2">
      <GitHubIcon size={16} class="text-emerald-600 dark:text-emerald-400" />
      <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {m.about_maintainer_title()}
      </h2>
    </div>
    <p class="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
      {m.about_maintainer_body()}
    </p>
    <a
      href={githubContributorsLink}
      target="_blank"
      rel="noopener noreferrer"
      class="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
    >
      {m.about_contributors_cta()}
      <ArrowRight size={12} />
    </a>
  </section>

  <section class="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
    <h2 class="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{m.about_inspired_title()}</h2>
    <p class="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
      {inspiredParts.before}<a
        href={pitlyLink}
        target="_blank"
        rel="noopener noreferrer"
        class="font-semibold text-emerald-700 underline hover:opacity-80 dark:text-emerald-400"
      >Pitly</a>{inspiredParts.after}
    </p>
  </section>

  <section class="space-y-3">
    <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
      {m.about_resources_section_title()}
    </h2>
    <p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
      {m.about_opensource_content()}
    </p>

    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      {#each githubCards as card (card.title)}
        <a
          href={card.href}
          target={card.href.startsWith('http') ? '_blank' : undefined}
          rel={card.href.startsWith('http') ? 'noopener noreferrer' : undefined}
          class="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-emerald-500/45"
        >
          <div class="mb-2 flex items-center gap-2">
            <div class="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-500/12">
              <card.icon size={14} class="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-100">{card.title}</h3>
          </div>
          <p class="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{card.description}</p>
          <p class="mt-3 text-xs font-semibold text-emerald-700 transition group-hover:opacity-80 dark:text-emerald-400">
            {card.cta} ->
          </p>
        </a>
      {/each}
    </div>
  </section>

  <section
    class="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-500/25 dark:bg-emerald-500/10"
  >
    <div class="flex gap-3">
      <div
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white dark:bg-emerald-500/15"
      >
        <ListChecks size={16} class="text-emerald-600 dark:text-emerald-400" />
      </div>
      <div>
        <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {m.about_supported_title()}
        </h2>
        <p class="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {m.about_supported_body()}
        </p>
        <a
          href={localizeHref('/docs/brokers')}
          class="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
        >
          {m.about_supported_cta()}
          <ArrowRight size={12} />
        </a>
      </div>
    </div>
  </section>

  <section class="border-l-4 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 p-4 rounded">
    <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
      {m.about_disclaimer_title()}
    </h2>
    <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
      {m.about_disclaimer_content()}
    </p>
  </section>
</div>
