<!-- src/routes/data/TradesTable.svelte -->
<script lang="ts">
  import { Pencil, Trash2, Plus } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { db } from '$lib/db.js';
  import { useLiveQuery } from '$lib/utils/live-query.svelte.js';
  import { addTrade, updateTrade, deleteTrade } from '$lib/services/data.js';
  import type { Trade } from '../../core/types.js';
  import type { TradeRecord } from '$lib/db.js';
  import { formatDatetime } from '$lib/utils/format-date.js';
  import TradeForm from './TradeForm.svelte';
  import DeleteConfirm from './DeleteConfirm.svelte';
  import EmptyState from './EmptyState.svelte';

  let { sessionId, sessionYear }: { sessionId: string; sessionYear?: number } = $props();

  const trades = useLiveQuery(() =>
    db.trades.where('sessionId').equals(sessionId).sortBy('datetime'),
  );

  let showAddForm = $state(false);
  let editingId: number | null = $state(null);
  let deleteTarget: TradeRecord | null = $state(null);

  async function handleAdd(trade: Trade) {
    await addTrade({ sessionId, trade });
    showAddForm = false;
  }

  async function handleUpdate(id: number, trade: Trade) {
    await updateTrade({ id, changes: trade });
    editingId = null;
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    await deleteTrade({ id: deleteTarget.id });
    deleteTarget = null;
  }
</script>

<div>
  {#if !showAddForm}
    <div class="mb-3">
      <button
        onclick={() => {
          showAddForm = true;
          editingId = null;
        }}
        class="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus size={14} />
        {m.data_add_trade()}
      </button>
    </div>
  {:else}
    <div class="mb-3">
      <TradeForm defaultYear={sessionYear} onsave={handleAdd} oncancel={() => (showAddForm = false)} />
    </div>
  {/if}

  {#if !trades.current || trades.current.length === 0}
    <EmptyState message={m.data_empty_trades()} />
  {:else}
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-slate-200 text-xs font-medium uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <th class="px-3 py-2">{m.data_symbol()}</th>
            <th class="px-3 py-2">{m.data_isin()}</th>
            <th class="px-3 py-2">{m.data_datetime()}</th>
            <th class="px-3 py-2">{m.data_type()}</th>
            <th class="px-3 py-2 text-right">{m.data_quantity()}</th>
            <th class="px-3 py-2 text-right">{m.data_price()}</th>
            <th class="px-3 py-2 text-right">{m.data_proceeds()}</th>
            <th class="px-3 py-2 text-right">{m.data_commission()}</th>
            <th class="px-3 py-2">{m.data_currency()}</th>
            <th class="px-3 py-2">{m.data_actions()}</th>
          </tr>
        </thead>
        <tbody>
          {#each trades.current as trade (trade.id)}
            {#if editingId === trade.id}
              <tr>
                <td colspan="10" class="p-2">
                  <TradeForm
                    initial={trade}
                    onsave={(t) => handleUpdate(trade.id as number, t)}
                    oncancel={() => (editingId = null)}
                  />
                </td>
              </tr>
            {:else}
              <tr class="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{trade.symbol}</td>
                <td class="px-3 py-2 text-slate-500 dark:text-slate-400">{trade.isin ?? ''}</td>
                <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{formatDatetime(trade.datetime)}</td>
                <td class="px-3 py-2">
                  <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {trade.type === 'buy' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}">
                    {trade.type === 'buy' ? m.data_type_buy() : m.data_type_sell()}
                  </span>
                </td>
                <td class="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">{trade.quantity}</td>
                <td class="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">{trade.price.toFixed(2)}</td>
                <td class="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">{trade.proceeds.toFixed(2)}</td>
                <td class="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">{trade.commission.toFixed(2)}</td>
                <td class="px-3 py-2 text-slate-600 dark:text-slate-400">{trade.currency}</td>
                <td class="px-3 py-2">
                  <div class="flex gap-1">
                    <button
                      onclick={() => {
                        editingId = trade.id as number;
                        showAddForm = false;
                      }}
                      class="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                      aria-label={m.data_edit()}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onclick={() => (deleteTarget = trade)}
                      class="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                      aria-label={m.data_delete()}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <DeleteConfirm
    message={m.data_delete_row_confirm()}
    open={deleteTarget !== null}
    onconfirm={handleDelete}
    oncancel={() => (deleteTarget = null)}
  />
</div>
