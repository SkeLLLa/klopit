<script lang="ts">
  import { AlertCircle, ArrowRight, AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-svelte';
  import MetricCards from './MetricCards.svelte';
  import GainsTaxDonut from './GainsTaxDonut.svelte';
  import PortfolioDonut from './PortfolioDonut.svelte';
  import CountryExposureBar from './CountryExposureBar.svelte';
  import CurrencyExposureBar from './CurrencyExposureBar.svelte';
  import TaxBreakdownBars from './TaxBreakdownBars.svelte';
  import InvestedAreaChart from './InvestedAreaChart.svelte';
  import TaxTransactionsTable from './TaxTransactionsTable.svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { localizeHref } from '$lib/paraglide/runtime';
  import { pageTitle } from '$lib/state/page-title.svelte.js';
  import { sessionState } from '$lib/state/session.svelte.js';
  import { db } from '$lib/db.js';
  import type { TradeResultRecord, DividendResultRecord, CreditInterestResultRecord } from '$lib/db.js';
  import { useLiveQuery } from '$lib/utils/live-query.svelte.js';
  import { useSessionBootstrap } from '$lib/utils/use-session-bootstrap.svelte.js';
  import { isSessionStale } from '$lib/utils/stale.js';
  import { formatAccount } from '$lib/utils/account.js';
  import { formatDate } from '$lib/utils/format-date.js';
  import {
    calculateSessionTaxes,
    clearSessionResults,
  } from '$lib/services/tax.js';

  pageTitle.set(m.page_dashboard());

  // --- Bootstrap session state ---
  const bootstrap = useSessionBootstrap();

  // --- Derived session state ---
  const session = $derived(bootstrap.activeSession);
  const sessionId = $derived(bootstrap.activeSessionId);

  // --- Calculated sessions for dropdown ---
  const calculatedSessions = $derived(
    bootstrap.sessions.filter((s) => s.status === 'calculated'),
  );

  // --- Data queries ---
  const taxSummaryQuery = useLiveQuery(async () =>
    sessionId ? db.taxSummaries.get(sessionId) : undefined,
  );
  const taxSummary = $derived(taxSummaryQuery.current);

  const tradeResultsQuery = useLiveQuery(async () =>
    sessionId
      ? db.tradeResults.where('sessionId').equals(sessionId).toArray()
      : [],
  );
  const tradeResults = $derived(tradeResultsQuery.current ?? []);

  const dividendResultsQuery = useLiveQuery(async () =>
    sessionId
      ? db.dividendResults.where('sessionId').equals(sessionId).toArray()
      : [],
  );
  const dividendResults = $derived(dividendResultsQuery.current ?? []);

  const creditInterestResultsQuery = useLiveQuery(async () =>
    sessionId
      ? db.creditInterestResults.where('sessionId').equals(sessionId).toArray()
      : [],
  );
  const creditInterestResults = $derived(creditInterestResultsQuery.current ?? []);

  // --- Previous year data for YoY ---
  const prevYearData = useLiveQuery(async () => {
    if (!session) return undefined;
    const prevYear = session.year - 1;
    const prevSessions = await db.sessions
      .where('year')
      .equals(prevYear)
      .toArray();
    const calculated = prevSessions.find((s) => s.status === 'calculated');
    if (!calculated) return undefined;
    const summary = await db.taxSummaries.get(calculated.id);
    return { summary };
  });

  // --- Rate unavailability warning ---
  const hasRateWarning = $derived(
    (taxSummary?.missingRateCount ?? 0) > 0 ||
    tradeResults.some((t: TradeResultRecord) => t.rateUnavailable) ||
    dividendResults.some((d: DividendResultRecord) => d.rateUnavailable) ||
    creditInterestResults.some((r: CreditInterestResultRecord) => r.rateUnavailable),
  );

  // --- Carry-in cost basis warnings ---
  const hasCostBasisMissing = $derived(
    (taxSummary?.missingCostCount ?? 0) > 0 ||
    tradeResults.some((t: TradeResultRecord) => t.costBasisMissing),
  );
  const carryInWarnings = $derived(taxSummary?.carryInWarnings ?? []);

  // --- Sell trades count ---
  const sellTradeCount = $derived(
    tradeResults.filter((t: TradeResultRecord) => t.type === 'sell').length,
  );

  // --- Loading state: true until IndexedDB queries have resolved ---
  const loading = $derived(
    !bootstrap.initialized || (session?.status === 'calculated' && !taxSummary),
  );

  function handleSessionChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    sessionState.setActiveSession(select.value);
  }

  // --- Stale detection ---
  const stale = $derived(
    isSessionStale({
      calculatedAt: session?.calculatedAt,
      dataUpdatedAt: session?.dataUpdatedAt,
    }),
  );
  let recalculating = $state(false);

  async function handleRecalculate() {
    if (!sessionId) return;
    recalculating = true;
    try {
      await clearSessionResults({ sessionId });
      await calculateSessionTaxes({ sessionId });
    } finally {
      recalculating = false;
    }
  }
</script>

<h1 class="sr-only">{m.page_dashboard()}</h1>

{#if loading}
  <div class="flex flex-col items-center justify-center py-24 text-center">
    <LoaderCircle size={32} class="mb-3 animate-spin text-slate-400" />
  </div>
{:else if bootstrap.sessions.length === 0}
  <!-- No sessions exist at all -->
  <div class="flex flex-col items-center justify-center py-24 text-center">
    <AlertCircle size={40} class="mb-3 text-slate-400" />
    <p class="text-sm text-slate-500 dark:text-slate-400">
      {m.dash_no_sessions()}
    </p>
    <a
      href="/data"
      class="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
    >
      {m.tax_go_to_data()} <ArrowRight size={14} />
    </a>
  </div>
{:else if calculatedSessions.length === 0 || !taxSummary}
  <!-- Session not calculated -->
  <div class="flex flex-col items-center justify-center py-24 text-center">
    <AlertCircle size={40} class="mb-3 text-slate-400" />
    <p class="text-sm text-slate-500 dark:text-slate-400">
      {m.dash_not_calculated()}
    </p>
    <a
      href="/tax-form"
      class="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
    >
      {m.nav_tax_form()} <ArrowRight size={14} />
    </a>
  </div>
{:else}
  <div class="space-y-6">
    <!-- Header with session selector -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {m.page_dashboard()}
      </h2>
      {#if calculatedSessions.length > 1}
        <select
          aria-label={m.data_session_label()}
          value={sessionId}
          onchange={handleSessionChange}
          class="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          {#each calculatedSessions as s (s.id)}
            <option value={s.id}>{s.year}</option>
          {/each}
        </select>
      {/if}
    </div>

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
          disabled={recalculating}
          class="inline-flex items-center gap-1.5 rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
        >
          <RefreshCw size={14} class={recalculating ? 'animate-spin' : ''} />
          {m.tax_recalculate()}
        </button>
      </div>
    {/if}

    <!-- Rate warning banner -->
    {#if hasRateWarning}
      <div class="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
        <AlertTriangle size={16} />
        <span>{m.dash_rates_warning()}</span>
        <a href="/rates" class="ml-auto font-medium underline">{m.page_rates()}</a>
      </div>
    {/if}

    <!-- Carry-in cost basis missing banner -->
    {#if hasCostBasisMissing}
      <div role="alert" class="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
        <AlertTriangle size={16} />
        <span>{m.dashboard_cost_basis_missing_warning()}</span>
        <a href={localizeHref('/data#carry-in')} class="ml-auto font-medium underline">{m.data_tab_carry_in()}</a>
      </div>
    {/if}

    <!-- Carry-in reconciliation with imported trades -->
    {#if carryInWarnings.length > 0}
      <div class="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
        <ul class="list-disc space-y-1 pl-5">
          {#each carryInWarnings as warning, i (i)}
            <li>
              {#if warning.kind === 'carry-in-overlap'}
                {m.import_warning_carry_in_overlap({
                  symbol: warning.symbol,
                  covered: String(warning.coveredQuantity),
                  quantity: String(warning.carryInQuantity),
                })}
              {:else if warning.kind === 'carry-in-inconsistent'}
                {m.import_warning_carry_in_inconsistent({
                  symbol: warning.symbol,
                  year: String(warning.year),
                  quantity: String(warning.carryInQuantity),
                  implied: String(warning.impliedQuantity),
                })}
              {:else if warning.kind === 'account-unassigned'}
                {#if warning.overlap}
                  {m.import_warning_account_unassigned_overlap({ symbol: warning.symbol })}
                {:else}
                  {m.import_warning_account_unassigned({ symbol: warning.symbol })}
                {/if}
              {:else if warning.kind === 'account-assumed'}
                {m.import_warning_account_assumed({
                  symbol: warning.symbol,
                  account: formatAccount(warning.account),
                })}
              {:else if warning.kind === 'transfer-suggested'}
                {m.import_warning_transfer_suggested({
                  symbol: warning.instrument,
                  from: formatAccount(warning.fromAccount),
                  to: formatAccount(warning.toAccount),
                  quantity: String(warning.quantity),
                  date: formatDate(warning.before),
                })}
              {:else if warning.kind === 'shortfall-add-carry-in'}
                {m.import_warning_shortfall_add_carry_in({
                  symbol: warning.instrument,
                  account: formatAccount(warning.account),
                  quantity: String(warning.quantity),
                  date: formatDate(warning.before),
                })}
              {:else}
                {m.import_warning_carry_in_cost_prorated({
                  symbol: warning.symbol,
                  year: String(warning.year),
                  seeded: String(warning.seededQuantity),
                  quantity: String(warning.carryInQuantity),
                })}
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <!-- Metric Cards -->
    <MetricCards
      {taxSummary}
      prevYearSummary={prevYearData.current?.summary}
      {sellTradeCount}
      dividendCount={dividendResults.length}
      creditInterestCount={creditInterestResults.length}
    />

    <!-- Donut charts -->
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <GainsTaxDonut {taxSummary} {dividendResults} />
      <PortfolioDonut {tradeResults} />
    </div>

    <!-- Invested over time -->
    <InvestedAreaChart {tradeResults} {dividendResults} {creditInterestResults} year={session?.year ?? 0} />

    <!-- Diversification bars -->
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <CountryExposureBar {tradeResults} />
      <CurrencyExposureBar {tradeResults} />
    </div>

    <!-- Tax breakdown bars -->
    <TaxBreakdownBars {taxSummary} {dividendResults} />

    <!-- Tax transactions detail table -->
    <TaxTransactionsTable {tradeResults} {dividendResults} {creditInterestResults} />
  </div>
{/if}
