<!-- src/routes/data/CorporateActionsTable.svelte -->
<script lang="ts">
  import { Pencil, Trash2 } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { db, type CorporateActionRecord } from '$lib/db.js';
  import { useLiveQuery } from '$lib/utils/live-query.svelte.js';
  import {
    updateCorporateAction,
    deleteCorporateAction,
  } from '$lib/services/data.js';
  import { formatDatetime, toDatetimeLocal } from '$lib/utils/format-date.js';
  import MissingIsinLookup from '$lib/components/ui/MissingIsinLookup.svelte';
  import DeleteConfirm from '$lib/components/DeleteConfirm.svelte';
  import EmptyState from './EmptyState.svelte';

  let { sessionId }: { sessionId: string } = $props();

  const records = useLiveQuery(() =>
    db.corporateActions
      .where('sessionId')
      .equals(sessionId)
      .sortBy('datetime'),
  );

  function formatCashProceeds(row: CorporateActionRecord): string {
    if (row.cashTotalProceeds !== undefined && row.cashTotalProceeds > 0) {
      return `${row.cashCurrency ?? ''} ${row.cashTotalProceeds.toFixed(2)}`;
    }
    return '';
  }

  let editingId: number | null = $state(null);
  let editType: 'stock-split' | 'merger' = $state('stock-split');
  let editSymbol = $state('');
  let editIsin = $state('');
  let editDatetime = $state('');
  let editNumerator = $state('');
  let editDenominator = $state('');
  let editTargetSymbol = $state('');
  let editTargetIsin = $state('');
  let editConversionRatio = $state('');
  let editCashPerShare = $state('');
  let editCashCurrency = $state('');
  let deleteTarget: CorporateActionRecord | null = $state(null);

  function startEdit(row: CorporateActionRecord) {
    editingId = row.id as number;
    editType = row.type;
    editSymbol = row.symbol;
    editIsin = row.isin ?? '';
    editDatetime = toDatetimeLocal(row.datetime);
    editNumerator = String(row.numerator);
    editDenominator = String(row.denominator);
    editTargetSymbol = row.targetSymbol ?? '';
    editTargetIsin = row.targetIsin ?? '';
    editConversionRatio = String(row.conversionRatio ?? '');
    editCashPerShare = String(row.cashPerShare ?? '');
    editCashCurrency = row.cashCurrency ?? '';
  }

  async function saveEdit() {
    if (editingId === null) return;
    await updateCorporateAction({
      id: editingId,
      changes: {
        type: editType,
        symbol: editSymbol.trim().toUpperCase(),
        isin: editIsin.trim() || undefined,
        datetime: new Date(editDatetime),
        numerator: parseFloat(editNumerator) || 0,
        denominator: parseFloat(editDenominator) || 0,
        targetSymbol: editTargetSymbol.trim().toUpperCase() || undefined,
        targetIsin: editTargetIsin.trim() || undefined,
        conversionRatio: parseFloat(editConversionRatio) || undefined,
        cashPerShare: parseFloat(editCashPerShare) || undefined,
        cashCurrency: editCashCurrency.trim().toUpperCase() || undefined,
      },
    });
    editingId = null;
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    await deleteCorporateAction({ id: deleteTarget.id });
    deleteTarget = null;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') editingId = null;
  }
</script>

<div>
  {#if !records.current || records.current.length === 0}
    <EmptyState message={m.data_empty_corporate_actions()} />
  {:else}
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-slate-200 text-xs font-medium uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <th class="px-3 py-2">{m.data_type()}</th>
            <th class="px-3 py-2">{m.data_symbol()}</th>
            <th class="px-3 py-2">{m.data_isin()}</th>
            <th class="px-3 py-2">{m.data_datetime()}</th>
            <th class="px-3 py-2">{m.data_details()}</th>
            <th class="px-3 py-2 text-right">{m.data_cash_proceeds()}</th>
            <th class="px-3 py-2">{m.data_actions()}</th>
          </tr>
        </thead>
        <tbody>
          {#each records.current as row (row.id)}
            {#if editingId === row.id}
              <tr class="border-b border-slate-100 dark:border-slate-800">
                <td class="px-3 py-2">
                  <select bind:value={editType} class="rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                    <option value="stock-split">stock-split</option>
                    <option value="merger">merger</option>
                  </select>
                </td>
                <td class="px-3 py-2"><input type="text" bind:value={editSymbol} onkeydown={handleKeydown} class="w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" /></td>
                <td class="px-3 py-2"><input type="text" bind:value={editIsin} onkeydown={handleKeydown} class="w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" /></td>
                <td class="px-3 py-2"><input type="datetime-local" bind:value={editDatetime} onkeydown={handleKeydown} class="w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" /></td>
                <td class="px-3 py-2">
                  {#if editType === 'stock-split'}
                    <div class="flex items-center gap-1">
                      <input type="number" step="any" bind:value={editNumerator} onkeydown={handleKeydown} class="w-16 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
                      <span class="text-slate-400">for</span>
                      <input type="number" step="any" bind:value={editDenominator} onkeydown={handleKeydown} class="w-16 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
                    </div>
                  {:else}
                    <div class="flex flex-col gap-1">
                      <div class="flex items-center gap-1">
                        <input type="text" bind:value={editTargetSymbol} placeholder="Target symbol" onkeydown={handleKeydown} class="w-20 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
                        <input type="text" bind:value={editTargetIsin} placeholder="Target ISIN" onkeydown={handleKeydown} class="w-32 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
                      </div>
                      <div class="flex items-center gap-1">
                        <input type="number" step="any" bind:value={editNumerator} placeholder="Num" onkeydown={handleKeydown} class="w-20 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
                        <span class="text-xs text-slate-400">for</span>
                        <input type="number" step="any" bind:value={editDenominator} placeholder="Den" onkeydown={handleKeydown} class="w-20 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
                      </div>
                      <div class="flex items-center gap-1">
                        <input type="text" bind:value={editCashCurrency} placeholder="CCY" onkeydown={handleKeydown} class="w-14 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
                        <input type="number" step="any" bind:value={editCashPerShare} placeholder="Cash/share" onkeydown={handleKeydown} class="w-24 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
                      </div>
                    </div>
                  {/if}
                </td>
                <td class="px-3 py-2"></td>
                <td class="px-3 py-2">
                  <div class="flex gap-1">
                    <button onclick={saveEdit} class="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700">{m.data_save()}</button>
                    <button onclick={() => (editingId = null)} class="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">{m.data_cancel()}</button>
                  </div>
                </td>
              </tr>
            {:else}
              <tr class="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                <td class="px-3 py-2">
                  <span class="inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">{row.type}</span>
                </td>
                <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{row.symbol}</td>
                <td class="px-3 py-2 text-slate-500 dark:text-slate-400">
                  {#if row.isin}
                    {row.isin}
                  {:else}
                    <MissingIsinLookup symbol={row.symbol} />
                  {/if}
                </td>
                <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{formatDatetime(row.datetime)}</td>
                <td class="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {#if row.type === 'stock-split'}
                    <span class="tabular-nums">{row.numerator} for {row.denominator}</span>
                  {:else}
                    <div class="flex flex-col gap-0.5">
                      <span>
                        <span class="font-medium text-slate-900 dark:text-slate-100">{row.symbol}</span>
                        <span class="text-slate-400 mx-1">&rarr;</span>
                        <span class="font-medium text-slate-900 dark:text-slate-100">{row.targetSymbol ?? row.targetIsin ?? '?'}</span>
                      </span>
                      <span class="text-xs tabular-nums">
                        {m.data_merger_ratio()}: {row.numerator}/{row.denominator}
                        <span class="text-slate-400 mx-0.5">=</span>
                        {(row.conversionRatio ?? 0).toFixed(6)} shares
                      </span>
                      {#if row.cashPerShare}
                        <span class="text-xs tabular-nums text-amber-600 dark:text-amber-400">
                          + {row.cashCurrency ?? ''} {row.cashPerShare.toFixed(4)}/share
                          <span class="text-slate-400 ml-1">({m.data_merger_taxable()})</span>
                        </span>
                      {/if}
                    </div>
                  {/if}
                </td>
                <td class="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                  {#if row.type === 'stock-split'}
                    <span class="text-slate-400">&mdash;</span>
                  {:else}
                    {formatCashProceeds(row)}
                  {/if}
                </td>
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
