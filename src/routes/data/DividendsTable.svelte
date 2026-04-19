<!-- src/routes/data/DividendsTable.svelte -->
<script lang="ts">
  import { Pencil, Trash2, Plus } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { db, type DividendRecord } from '$lib/db.js';
  import { useLiveQuery } from '$lib/utils/live-query.svelte.js';
  import { addDividend, updateDividend, deleteDividend } from '$lib/services/data.js';
  import type { RawDividend } from '../../core/types.js';
  import { formatDate } from '$lib/utils/format-date.js';
  import DividendForm from './DividendForm.svelte';
  import DeleteConfirm from '$lib/components/DeleteConfirm.svelte';
  import EmptyState from './EmptyState.svelte';

  let { sessionId, sessionYear }: { sessionId: string; sessionYear?: number } = $props();

  const dividends = useLiveQuery(() =>
    db.dividends.where('sessionId').equals(sessionId).sortBy('date'),
  );

  let showAddForm = $state(false);
  let editingId: number | null = $state(null);
  let deleteTarget: DividendRecord | null = $state(null);

  async function handleAdd(dividend: RawDividend) {
    await addDividend({ sessionId, dividend });
    showAddForm = false;
  }

  async function handleUpdate(id: number, dividend: RawDividend) {
    await updateDividend({ id, changes: dividend });
    editingId = null;
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    await deleteDividend({ id: deleteTarget.id });
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
        {m.data_add_dividend()}
      </button>
    </div>
  {:else}
    <div class="mb-3">
      <DividendForm defaultYear={sessionYear} onsave={handleAdd} oncancel={() => (showAddForm = false)} />
    </div>
  {/if}

  {#if !dividends.current || dividends.current.length === 0}
    <EmptyState message={m.data_empty_dividends()} />
  {:else}
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-slate-200 text-xs font-medium uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <th class="px-3 py-2">{m.data_symbol()}</th>
            <th class="px-3 py-2">{m.data_isin()}</th>
            <th class="px-3 py-2">{m.data_date()}</th>
            <th class="px-3 py-2 text-right">{m.data_amount()}</th>
            <th class="px-3 py-2">{m.data_currency()}</th>
            <th class="px-3 py-2">{m.data_actions()}</th>
          </tr>
        </thead>
        <tbody>
          {#each dividends.current as row (row.id)}
            {#if editingId === row.id}
              <tr>
                <td colspan="6" class="p-2">
                  {#key editingId}
                    <DividendForm
                      initial={row}
                      onsave={(d) => handleUpdate(row.id as number, d)}
                      oncancel={() => (editingId = null)}
                    />
                  {/key}
                </td>
              </tr>
            {:else}
              <tr class="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{row.symbol}</td>
                <td class="px-3 py-2 text-slate-500 dark:text-slate-400">{row.isin ?? ''}</td>
                <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{formatDate(row.date)}</td>
                <td class="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">{row.amount.toFixed(2)}</td>
                <td class="px-3 py-2 text-slate-600 dark:text-slate-400">{row.currency}</td>
                <td class="px-3 py-2">
                  <div class="flex gap-1">
                    <button
                      onclick={() => {
                        editingId = row.id as number;
                        showAddForm = false;
                      }}
                      class="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                      aria-label={m.data_edit()}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onclick={() => (deleteTarget = row)}
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
