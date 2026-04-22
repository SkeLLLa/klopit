<!-- src/routes/data/WithholdingTable.svelte -->
<script lang="ts">
  import { Pencil, Trash2 } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { db, type WithholdingTaxRecord } from '$lib/db.js';
  import { useLiveQuery } from '$lib/utils/live-query.svelte.js';
  import {
    updateWithholdingTax,
    deleteWithholdingTax,
  } from '$lib/services/data.js';
  import { formatDate, toDateInput } from '$lib/utils/format-date.js';
  import MissingIsinLookup from '$lib/components/ui/MissingIsinLookup.svelte';
  import DeleteConfirm from '$lib/components/DeleteConfirm.svelte';
  import EmptyState from './EmptyState.svelte';

  let { sessionId }: { sessionId: string } = $props();

  const records = useLiveQuery(() =>
    db.withholdingTaxes.where('sessionId').equals(sessionId).sortBy('date'),
  );

  let editingId: number | null = $state(null);
  let editSymbol = $state('');
  let editIsin = $state('');
  let editDate = $state('');
  let editAmount = $state('');
  let editCurrency = $state('');
  let deleteTarget: WithholdingTaxRecord | null = $state(null);

  function startEdit(row: WithholdingTaxRecord) {
    editingId = row.id as number;
    editSymbol = row.symbol;
    editIsin = row.isin ?? '';
    editDate = toDateInput(row.date);
    editAmount = String(row.amount);
    editCurrency = row.currency;
  }

  async function saveEdit() {
    if (editingId === null) return;
    await updateWithholdingTax({
      id: editingId,
      changes: {
        symbol: editSymbol.trim().toUpperCase(),
        isin: editIsin.trim() || undefined,
        date: new Date(editDate),
        amount: parseFloat(editAmount),
        currency: editCurrency.trim().toUpperCase(),
      },
    });
    editingId = null;
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    await deleteWithholdingTax({ id: deleteTarget.id });
    deleteTarget = null;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') editingId = null;
  }
</script>

<div>
  {#if !records.current || records.current.length === 0}
    <EmptyState message={m.data_empty_withholding()} />
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
          {#each records.current as row (row.id)}
            {#if editingId === row.id}
              <tr class="border-b border-slate-100 dark:border-slate-800">
                <td class="px-3 py-2"><input type="text" bind:value={editSymbol} onkeydown={handleKeydown} class="w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" /></td>
                <td class="px-3 py-2"><input type="text" bind:value={editIsin} onkeydown={handleKeydown} class="w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" /></td>
                <td class="px-3 py-2"><input type="date" bind:value={editDate} onkeydown={handleKeydown} class="w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" /></td>
                <td class="px-3 py-2"><input type="number" step="any" bind:value={editAmount} onkeydown={handleKeydown} class="w-full rounded border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" /></td>
                <td class="px-3 py-2"><input type="text" bind:value={editCurrency} onkeydown={handleKeydown} class="w-20 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" /></td>
                <td class="px-3 py-2">
                  <div class="flex gap-1">
                    <button onclick={saveEdit} class="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700">{m.data_save()}</button>
                    <button onclick={() => (editingId = null)} class="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">{m.data_cancel()}</button>
                  </div>
                </td>
              </tr>
            {:else}
              <tr class="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{row.symbol}</td>
                <td class="px-3 py-2 text-slate-500 dark:text-slate-400">
                  {#if row.isin}
                    {row.isin}
                  {:else}
                    <MissingIsinLookup symbol={row.symbol} />
                  {/if}
                </td>
                <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{formatDate(row.date)}</td>
                <td class="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">{row.amount.toFixed(2)}</td>
                <td class="px-3 py-2 text-slate-600 dark:text-slate-400">{row.currency}</td>
                <td class="px-3 py-2">
                  <div class="flex gap-1">
                    <button onclick={() => startEdit(row)} class="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300" aria-label={m.data_edit()}><Pencil size={14} /></button>
                    <button onclick={() => (deleteTarget = row)} class="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400" aria-label={m.data_delete()}><Trash2 size={14} /></button>
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
