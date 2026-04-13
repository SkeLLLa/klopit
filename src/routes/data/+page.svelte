<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { pageTitle } from '$lib/state/page-title.svelte.js';
  import { db } from '$lib/db.js';
  import { useLiveQuery } from '$lib/utils/live-query.svelte.js';
  import { sessionState } from '$lib/state/session.svelte.js';
  import SessionBar from './SessionBar.svelte';
  import SessionInfo from './SessionInfo.svelte';
  import ActionBar from './ActionBar.svelte';
  import DataTabs from './DataTabs.svelte';
  import TradesTable from './TradesTable.svelte';
  import DividendsTable from './DividendsTable.svelte';
  import WithholdingTable from './WithholdingTable.svelte';
  import CorporateActionsTable from './CorporateActionsTable.svelte';
  import CarryInTable from './CarryInTable.svelte';
  import CountryMappingTable from './CountryMappingTable.svelte';
  import DeleteConfirm from './DeleteConfirm.svelte';
  import EmptyState from './EmptyState.svelte';

  $effect(() => {
    pageTitle.set(m.page_data());
  });

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
  const activeSession = $derived(sessionState.activeSession);

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
  const carryInCount = useLiveQuery(() =>
    activeSessionId
      ? db.carryInPositions.where('sessionId').equals(activeSessionId).count()
      : Promise.resolve(0),
  );

  const counts = $derived({
    trades: tradeCount.current ?? 0,
    dividends: dividendCount.current ?? 0,
    withholding: withholdingCount.current ?? 0,
    corporateActions: corporateActionCount.current ?? 0,
    carryIn: carryInCount.current ?? 0,
  });

  // --- Dialogs ---
  let showDeleteSessionConfirm = $state(false);

  async function handleCreateSession(year: number) {
    await sessionState.createSession(year);
  }

  async function handleDeleteSession() {
    await sessionState.deleteSession();
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

      <DataTabs activeTab="trades" {counts}>
        {#snippet children(tab)}
          {#if tab === 'trades'}
            <TradesTable sessionId={activeSession.id} sessionYear={activeSession.year} />
          {:else if tab === 'dividends'}
            <DividendsTable sessionId={activeSession.id} />
          {:else if tab === 'withholding'}
            <WithholdingTable sessionId={activeSession.id} />
          {:else if tab === 'corporateActions'}
            <CorporateActionsTable sessionId={activeSession.id} />
          {:else if tab === 'carryIn'}
            <CarryInTable sessionId={activeSession.id} />
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
