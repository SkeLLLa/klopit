<script lang="ts">
  import { RefreshCw, AlertCircle, ArrowRight, AlertTriangle, Info } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { localizeHref } from '$lib/paraglide/runtime';
  import { pageTitle } from '$lib/state/page-title.svelte.js';
  import { db } from '$lib/db.js';
  import { useLiveQuery } from '$lib/utils/live-query.svelte.js';
  import { useSessionBootstrap } from '$lib/utils/use-session-bootstrap.svelte.js';
  import { updateSession } from '$lib/services/session.js';
  import {
    calculateSessionTaxes,
    clearSessionResults,
  } from '$lib/services/tax.js';
  import { isSessionStale } from '$lib/utils/stale.js';
  import OppDonation from './OppDonation.svelte';
  import DocumentSidebar from './DocumentSidebar.svelte';
  import PitZgView from './PitZgView.svelte';
  import SectionC from './SectionC.svelte';
  import SectionD from './SectionD.svelte';
  import SectionE from './SectionE.svelte';
  import SectionF from './SectionF.svelte';
  import SectionG from './SectionG.svelte';
  import SectionH from './SectionH.svelte';

  pageTitle.set(m.page_tax_form());

  // --- Bootstrap session state (in case user navigates here directly) ---
  const bootstrap = useSessionBootstrap();

  // --- State ---
  let calculating = $state(false);
  let error: string | null = $state(null);

  const session = $derived(bootstrap.activeSession);
  const sessionId = $derived(bootstrap.activeSessionId);

  // Read tax summary from Dexie
  const taxSummaryQuery = useLiveQuery(async () =>
    sessionId ? db.taxSummaries.get(sessionId) : undefined,
  );
  const taxSummary = $derived(taxSummaryQuery.current);
  const pit38 = $derived(taxSummary?.pit38);
  const includeAllInPitZg = $derived(session?.includeAllInPitZg ?? false);
  const stale = $derived(
    isSessionStale({
      calculatedAt: session?.calculatedAt,
      dataUpdatedAt: session?.dataUpdatedAt,
    }),
  );

  type ActiveDocument = 'pit38' | { pitZg: string };
  let activeDocument: ActiveDocument = $state('pit38');

  const pitZgList = $derived(taxSummary?.pitZg ?? []);
  const pitZgCountries = $derived(pitZgList.map((z) => z.country));
  const pitZgMap = $derived(
    new Map(pitZgList.map((z) => [z.country, z])),
  );
  const activePitZg = $derived.by(() => {
    const doc = activeDocument;
    if (typeof doc === 'object') {
      return pitZgMap.get(doc.pitZg);
    }
    return undefined;
  });

  // Check if session has any data to calculate
  const tradeCount = useLiveQuery(() =>
    sessionId
      ? db.trades.where('sessionId').equals(sessionId).count()
      : Promise.resolve(0),
  );
  const dividendCount = useLiveQuery(() =>
    sessionId
      ? db.dividends.where('sessionId').equals(sessionId).count()
      : Promise.resolve(0),
  );
  const hasData = $derived(
    (tradeCount.current ?? 0) > 0 || (dividendCount.current ?? 0) > 0,
  );

  // Auto-calculate on navigation when session has data but no results
  $effect(() => {
    if (session && hasData && !pit38 && !calculating) {
      void runCalculation();
    }
  });

  async function runCalculation() {
    if (!sessionId) return;
    calculating = true;
    error = null;
    try {
      await calculateSessionTaxes({ sessionId });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      calculating = false;
    }
  }

  async function handleRecalculate() {
    if (!sessionId) return;
    calculating = true;
    error = null;
    try {
      await clearSessionResults({ sessionId });
      await calculateSessionTaxes({ sessionId });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      calculating = false;
    }
  }

  async function handleToggleIncludeAll(value: boolean) {
    if (!sessionId) return;
    await updateSession({
      id: sessionId,
      changes: {
        includeAllInPitZg: value,
        dataUpdatedAt: new Date(),
      },
    });
  }
</script>

<h1 class="sr-only">{m.page_tax_form()}</h1>

{#if !session}
  <!-- No session selected -->
  <div class="flex flex-col items-center justify-center py-24 text-center">
    <AlertCircle size={40} class="mb-3 text-slate-400" />
    <p class="text-sm text-slate-500 dark:text-slate-400">
      {m.tax_error_no_session()}
    </p>
    <a
      href="/data"
      class="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
    >
      {m.tax_go_to_data()} <ArrowRight size={14} />
    </a>
    <a
      href={localizeHref('/docs/pit-38')}
      class="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
    >
      {m.nav_docs_pit38()} <ArrowRight size={12} />
    </a>
  </div>
{:else if !hasData && !pit38}
  <!-- Session has no data -->
  <div class="flex flex-col items-center justify-center py-24 text-center">
    <AlertCircle size={40} class="mb-3 text-slate-400" />
    <p class="text-sm text-slate-500 dark:text-slate-400">
      {m.tax_error_no_data()}
    </p>
    <a
      href="/data"
      class="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
    >
      {m.tax_go_to_data()} <ArrowRight size={14} />
    </a>
  </div>
{:else if calculating}
  <!-- Calculating -->
  <div class="flex flex-col items-center justify-center py-24 text-center">
    <RefreshCw size={32} class="mb-3 animate-spin text-blue-500" />
    <p class="text-sm text-slate-600 dark:text-slate-400">
      {m.tax_calculating()}
    </p>
  </div>
{:else if error}
  <!-- Error -->
  <div class="flex flex-col items-center justify-center py-24 text-center">
    <AlertCircle size={40} class="mb-3 text-red-500" />
    <p class="text-sm text-red-600 dark:text-red-400">
      {m.tax_error_calculation({ error })}
    </p>
    <button
      onclick={() => void runCalculation()}
      class="mt-3 rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
    >
      {m.tax_retry()}
    </button>
  </div>
{:else if pit38}
  <!-- Tax form with sidebar -->
  <div class="space-y-4">
    <!-- Stale banner -->
    {#if stale}
      <div
        class="flex items-center justify-between gap-3 rounded border border-amber-400 bg-amber-50 px-4 py-2 dark:border-amber-500/60 dark:bg-amber-500/10"
      >
        <div class="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle size={16} />
          <span>{m.tax_stale_banner()}</span>
        </div>
        <button
          onclick={() => void handleRecalculate()}
          class="inline-flex items-center gap-1.5 rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
        >
          <RefreshCw size={14} />
          {m.tax_recalculate()}
        </button>
      </div>
    {/if}

    <!-- Recalculate bar -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
        PIT-38 ({session.year})
      </h2>
      <button
        onclick={() => void handleRecalculate()}
        class="inline-flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <RefreshCw size={14} />
        {m.tax_recalculate()}
      </button>
    </div>

    <!-- Transparency banner -->
    <div
      class="flex items-center justify-between gap-3 rounded border border-blue-200 bg-blue-50 px-4 py-2 text-sm dark:border-blue-500/40 dark:bg-blue-500/10"
    >
      <div class="flex items-center gap-2 text-blue-800 dark:text-blue-200">
        <Info size={16} class="shrink-0" />
        <span>{m.taxform_transparency_banner_body()}</span>
      </div>
      <a
        href={localizeHref('/dashboard')}
        class="shrink-0 text-xs font-medium text-blue-700 hover:underline dark:text-blue-300"
      >
        {m.taxform_transparency_banner_cta()} <ArrowRight size={12} class="inline" />
      </a>
    </div>

    <!-- OPP Donation -->
    <OppDonation
      sessionId={session.id}
      taxToPay={pit38[51]}
      krs={session.oppKrs ?? ''}
      details={session.oppDetails ?? ''}
      consent={session.oppConsent ?? false}
    />

    <!-- Sidebar + Content layout -->
    <div class="flex gap-6">
      <DocumentSidebar
        countries={pitZgCountries}
        {activeDocument}
        {includeAllInPitZg}
        onToggleIncludeAll={handleToggleIncludeAll}
        onselect={(doc) => (activeDocument = doc)}
      />

      <div class="min-w-0 flex-1">
        {#if typeof activeDocument === 'string'}
          <!-- PIT-38 sections -->
          <div class="space-y-4">
            <SectionC {pit38} />
            <SectionD {pit38} lossDeduction={taxSummary?.lossDeduction} />
            <SectionE {pit38} />
            <SectionF {pit38} />
            <SectionG {pit38} />
            <SectionH {pit38} />
          </div>
        {:else if activePitZg}
          <PitZgView pitZg={activePitZg} />
        {/if}
      </div>
    </div>
  </div>
{/if}
