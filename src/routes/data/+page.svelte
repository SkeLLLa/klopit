<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import {
    deriveImportWarnings,
    mergeImportWarnings,
  } from '$lib/services/import.js';
  import { pageTitle } from '$lib/state/page-title.svelte.js';
  import { skippedRowsStore } from '$lib/state/skipped-rows.svelte.js';
  import { db, type SessionRecord } from '$lib/db.js';
  import { useLiveQuery } from '$lib/utils/live-query.svelte.js';
  import { sessionState } from '$lib/state/session.svelte.js';
  import type { ImportWarning } from '../../core/types.js';
  import SessionBar from './SessionBar.svelte';
  import SessionInfo from './SessionInfo.svelte';
  import ActionBar from './ActionBar.svelte';
  import DataTabs from './DataTabs.svelte';
  import SkippedTable from './SkippedTable.svelte';
  import TradesTable from './TradesTable.svelte';
  import DividendsTable from './DividendsTable.svelte';
  import WithholdingTable from './WithholdingTable.svelte';
  import CorporateActionsTable from './CorporateActionsTable.svelte';
  import CarryInTable from './CarryInTable.svelte';
  import CreditInterestTable from './CreditInterestTable.svelte';
  import CountryMappingTable from './CountryMappingTable.svelte';
  import DeleteConfirm from './DeleteConfirm.svelte';
  import EmptyState from './EmptyState.svelte';

  $effect(() => {
    pageTitle.set(m.page_data());
  });

  const messages = m as unknown as Record<
    string,
    (inputs?: Record<string, string>) => string
  >;
  function t(key: string, fallback: string, inputs?: Record<string, string>): string {
    const fn = messages[key];
    if (typeof fn === 'function') return fn(inputs ?? {});
    if (!inputs) return fallback;
    return Object.entries(inputs).reduce(
      (value, [name, replacement]) => value.replaceAll(`{${name}}`, replacement),
      fallback,
    );
  }

  type SessionWithImportWarnings = SessionRecord & {
    importWarnings?: ImportWarning[];
  };

  // --- Session state (drive liveQuery here, sync into shared state) ---
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
  const sessions = $derived(sessionState.sessions);
  const activeSessionId = $derived(sessionState.activeSessionId);
  const activeSession = $derived(
    sessionState.activeSession as SessionWithImportWarnings | undefined,
  );

  // --- Tab counts (reactive) ---
  const tradeCount = useLiveQuery(() =>
    activeSessionId
      ? db.trades.where('sessionId').equals(activeSessionId).count()
      : Promise.resolve(0),
  );
  const dividendCount = useLiveQuery(() =>
    activeSessionId
      ? db.dividends.where('sessionId').equals(activeSessionId).count()
      : Promise.resolve(0),
  );
  const withholdingCount = useLiveQuery(() =>
    activeSessionId
      ? db.withholdingTaxes.where('sessionId').equals(activeSessionId).count()
      : Promise.resolve(0),
  );
  const corporateActionCount = useLiveQuery(() =>
    activeSessionId
      ? db.corporateActions.where('sessionId').equals(activeSessionId).count()
      : Promise.resolve(0),
  );
  const creditInterestCount = useLiveQuery(() =>
    activeSessionId
      ? db.creditInterests.where('sessionId').equals(activeSessionId).count()
      : Promise.resolve(0),
  );
  const carryInCount = useLiveQuery(() =>
    activeSessionId
      ? db.carryInPositions.where('sessionId').equals(activeSessionId).count()
      : Promise.resolve(0),
  );
  const inMemorySkippedRows = $derived(
    activeSessionId ? skippedRowsStore.getSkippedRows({ sessionId: activeSessionId }) : [],
  );
  // Merge on read to tolerate pre-fix persisted data that may contain duplicate
  // (section, kind) entries from multiple file imports. Merge is idempotent.
  const persistedImportWarnings = $derived(
    mergeImportWarnings({ warnings: activeSession?.importWarnings ?? [] }),
  );
  const importWarnings = $derived(
    inMemorySkippedRows.length > 0
      ? deriveImportWarnings({ skippedRows: inMemorySkippedRows })
      : persistedImportWarnings,
  );
  const skippedCount = $derived(
    activeSessionId
      ? inMemorySkippedRows.length > 0
        ? inMemorySkippedRows.length
        : importWarnings.reduce((sum, warning) => sum + warning.rowCount, 0)
      : 0,
  );

  const counts = $derived({
    trades: tradeCount.current ?? 0,
    dividends: dividendCount.current ?? 0,
    interest: creditInterestCount.current ?? 0,
    withholding: withholdingCount.current ?? 0,
    corporateActions: corporateActionCount.current ?? 0,
    carryIn: carryInCount.current ?? 0,
    skipped: skippedCount,
  });

  // --- Dialogs ---
  let showDeleteSessionConfirm = $state(false);

  async function handleCreateSession(year: number) {
    await sessionState.createSession(year);
  }

  async function handleDeleteSession() {
    const deletedSessionId = activeSessionId;
    await sessionState.deleteSession();
    if (deletedSessionId) {
      skippedRowsStore.clearSkippedRows({ sessionId: deletedSessionId });
    }
    showDeleteSessionConfirm = false;
  }
</script>

{#if sessions.length === 0}
  <div class="flex flex-col items-center justify-center py-24 text-center">
    <EmptyState message={m.data_no_sessions()} />
    <div class="mt-4">
      <SessionBar
        {sessions}
        {activeSessionId}
        onselect={(id) => sessionState.setActiveSession(id)}
        oncreate={handleCreateSession}
      />
    </div>
  </div>
{:else}
  <div class="space-y-4">
    <SessionBar
      {sessions}
      {activeSessionId}
      onselect={(id) => sessionState.setActiveSession(id)}
      oncreate={handleCreateSession}
      ondelete={() => (showDeleteSessionConfirm = true)}
    />

    {#if activeSession}
      <SessionInfo files={activeSession.files} />

      <ActionBar
        sessionId={activeSession.id}
        session={activeSession}
        hasData={counts.trades > 0 || counts.dividends > 0}
      />

      {#if importWarnings.length > 0}
        <details
          class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
        >
          <summary class="cursor-pointer font-medium">
            {t('data_skipped_banner', 'Some data was not imported')} - {t(
              'data_skipped_banner_detail',
              '{count} rows skipped across {sectionCount} sections',
              {
                count: String(importWarnings.reduce((sum, warning) => sum + warning.rowCount, 0)),
                sectionCount: String(new Set(importWarnings.map((warning) => warning.section)).size),
              },
            )}
          </summary>
          <ul class="mt-2 list-disc space-y-1 pl-5 text-xs">
            {#each importWarnings as warning (warning.section + warning.kind)}
              <li>{warning.message}</li>
            {/each}
          </ul>
        </details>
      {/if}

      <DataTabs activeTab="trades" {counts}>
        {#snippet children(tab)}
          {#if tab === 'trades'}
            <TradesTable sessionId={activeSession.id} sessionYear={activeSession.year} />
          {:else if tab === 'dividends'}
            <DividendsTable sessionId={activeSession.id} />
          {:else if tab === 'interest'}
            <CreditInterestTable sessionId={activeSession.id} />
          {:else if tab === 'withholding'}
            <WithholdingTable sessionId={activeSession.id} />
          {:else if tab === 'corporateActions'}
            <CorporateActionsTable sessionId={activeSession.id} />
          {:else if tab === 'carryIn'}
            <CarryInTable sessionId={activeSession.id} />
          {:else if tab === 'skipped'}
            <SkippedTable sessionId={activeSession.id} />
          {/if}
        {/snippet}
      </DataTabs>

      <CountryMappingTable sessionId={activeSession.id} />

      <DeleteConfirm
        message={m.data_delete_session_confirm()}
        open={showDeleteSessionConfirm}
        onconfirm={handleDeleteSession}
        oncancel={() => (showDeleteSessionConfirm = false)}
      />
    {/if}
  </div>
{/if}
