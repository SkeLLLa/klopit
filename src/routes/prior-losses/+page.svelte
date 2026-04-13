<script lang="ts">
  import { AlertCircle, ArrowRight, Info } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { pageTitle } from '$lib/state/page-title.svelte.js';
  import { sessionState } from '$lib/state/session.svelte.js';
  import { db } from '$lib/db.js';
  import { useLiveQuery } from '$lib/utils/live-query.svelte.js';
  import PriorLossTable from '$lib/components/PriorLossTable.svelte';

  $effect(() => {
    pageTitle.set(m.page_prior_losses());
  });

  // Bootstrap session state if user lands here directly.
  const sessionsQuery = useLiveQuery(() =>
    db.sessions.orderBy('year').reverse().toArray(),
  );
  let initialized = $state(false);
  $effect(() => {
    const list = sessionsQuery.current;
    if (!list) return;
    if (!initialized) {
      sessionState.init(list);
      initialized = true;
    } else {
      sessionState.setSessions(list);
    }
  });

  const session = $derived(sessionState.activeSession);
</script>

<div class="space-y-4">
  <div>
    <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
      {m.prior_losses_title()}
    </h2>
    {#if session}
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {m.prior_losses_intro({ year: session.year })}
      </p>
    {/if}
  </div>

  <div
    class="flex items-start gap-2 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200"
  >
    <Info size={14} class="mt-0.5 shrink-0" />
    <span>{m.prior_losses_cap_explainer()}</span>
  </div>

  {#if !session}
    <div
      class="flex flex-col items-center justify-center rounded border border-dashed border-slate-300 py-12 text-center dark:border-slate-700"
    >
      <AlertCircle size={32} class="mb-2 text-slate-400" />
      <p class="text-sm text-slate-500 dark:text-slate-400">
        {m.prior_losses_no_session()}
      </p>
      <a
        href="/data"
        class="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
      >
        {m.tax_go_to_data()} <ArrowRight size={14} />
      </a>
    </div>
  {:else}
    <div
      class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
    >
      <PriorLossTable sessionId={session.id} sessionYear={session.year} />
    </div>
  {/if}
</div>
