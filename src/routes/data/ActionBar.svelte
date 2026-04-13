<script lang="ts">
  import { RefreshCw } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { calculateSessionTaxes } from '$lib/services/tax.js';
  import { isSessionStale } from '$lib/utils/stale.js';
  import type { SessionRecord } from '$lib/db.js';
  import ImportPanel from './ImportPanel.svelte';

  let {
    sessionId,
    session,
    hasData,
  }: {
    sessionId: string;
    session: SessionRecord | undefined;
    hasData: boolean;
  } = $props();

  let recalculating = $state(false);
  let recalcError: string | null = $state(null);

  const stale = $derived(
    isSessionStale({
      calculatedAt: session?.calculatedAt,
      dataUpdatedAt: session?.dataUpdatedAt,
    }),
  );
  const showRecalc = $derived(
    !!session?.calculatedAt && stale && hasData && !recalculating,
  );

  async function handleRecalculate() {
    recalculating = true;
    recalcError = null;
    try {
      await calculateSessionTaxes({ sessionId });
    } catch (e) {
      recalcError = e instanceof Error ? e.message : String(e);
    } finally {
      recalculating = false;
    }
  }
</script>

<div class="flex flex-wrap items-start justify-between gap-3">
  <div class="min-w-0 flex-1">
    <ImportPanel {sessionId} />
  </div>

  {#if showRecalc || recalculating}
    <div class="flex flex-col items-end gap-1">
      <button
        type="button"
        onclick={() => void handleRecalculate()}
        disabled={recalculating}
        class="inline-flex items-center gap-1.5 rounded border border-amber-400 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-500/60 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20"
      >
        <RefreshCw size={14} class={recalculating ? 'animate-spin' : ''} />
        {m.data_recalculate()}
      </button>
      <p class="text-xs text-amber-700 dark:text-amber-300">
        {m.data_stale_hint()}
      </p>
      {#if recalcError}
        <p class="text-xs text-red-600 dark:text-red-400">
          {m.data_recalculate_error({ error: recalcError })}
        </p>
      {/if}
    </div>
  {/if}
</div>
