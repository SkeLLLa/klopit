<!-- src/routes/data/WithholdingTable.svelte -->
<script lang="ts">
  import { Pencil, Trash2, Plus, Link } from '@lucide/svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { db, type WithholdingTaxRecord } from '#lib/db.js';
  import { useLiveQuery } from '#lib/utils/live-query.svelte.js';
  import {
    addWithholdingTax,
    ManualEntryValidationError,
    updateWithholdingTax,
    deleteWithholdingTax,
  } from '#lib/services/data.js';
  import { formatDate, toDateInput } from '#lib/utils/format-date.js';
  import { fromDateInput } from '#lib/utils/date-input.js';
  import MissingIsinLookup from '#lib/components/ui/MissingIsinLookup.svelte';
  import DeleteConfirm from '#lib/components/DeleteConfirm.svelte';
  import EmptyState from './EmptyState.svelte';
  import WithholdingForm from './WithholdingForm.svelte';
  import type { RawWithholdingTax } from '../../core/types.js';

  let { sessionId }: { sessionId: string } = $props();

  const records = useLiveQuery(() =>
    db.withholdingTaxes.where('sessionId').equals(sessionId).sortBy('date'),
  );

  let showAddForm = $state(false);
  let editingId: number | null = $state(null);
  let editError = $state('');
  let editSymbol = $state('');
  let editIsin = $state('');
  let editDate = $state('');
  let editAmount = $state('');
  let editCurrency = $state('');
  let deleteTarget: WithholdingTaxRecord | null = $state(null);

  function startEdit(row: WithholdingTaxRecord) {
    editingId = row.id as number;
    editError = '';
    editSymbol = row.symbol;
    editIsin = row.isin ?? '';
    editDate = toDateInput(row.date);
    editAmount = String(row.amount);
    editCurrency = row.currency;
  }

  async function handleAdd(withholding: RawWithholdingTax) {
    await addWithholdingTax({ sessionId, withholding });
    showAddForm = false;
  }

  async function saveEdit() {
    if (editingId === null) return;
    const row = records.current?.find((r) => r.id === editingId);
    const amount = parseFloat(editAmount);
    if (row?.dividendId !== undefined) {
      // Key fields follow the dividend; only the amount is editable.
      try {
        await updateWithholdingTax({ id: editingId, changes: { amount } });
        editingId = null;
      } catch (e) {
        if (!(e instanceof ManualEntryValidationError)) throw e;
        editError =
          e.code === 'withholding-exceeds-gross'
            ? m.data_validation_withholding_exceeds_gross()
            : m.data_withholding_amount_hint();
      }
      return;
    }
    const date = fromDateInput(editDate);
    if (!date) return;
    await updateWithholdingTax({
      id: editingId,
      changes: {
        symbol: editSymbol.trim().toUpperCase(),
        isin: editIsin.trim() || undefined,
        date,
        amount,
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
        {m.data_add_withholding()}
      </button>
    </div>
  {:else}
    <div class="mb-3">
      <WithholdingForm onsave={handleAdd} oncancel={() => (showAddForm = false)} />
    </div>
  {/if}

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
                <td class="px-3 py-2">{#if row.dividendId !== undefined}<span class="text-slate-500 dark:text-slate-400">{editSymbol}</span>{:else}<input type="text" aria-label={m.data_symbol()} bind:value={editSymbol} onkeydown={handleKeydown} class="w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />{/if}</td>
                <td class="px-3 py-2">{#if row.dividendId !== undefined}<span class="text-slate-500 dark:text-slate-400">{editIsin}</span>{:else}<input type="text" aria-label={m.data_isin()} bind:value={editIsin} onkeydown={handleKeydown} class="w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />{/if}</td>
                <td class="px-3 py-2">{#if row.dividendId !== undefined}<span class="text-slate-500 dark:text-slate-400">{formatDate(row.date)}</span>{:else}<input type="date" aria-label={m.data_date()} bind:value={editDate} onkeydown={handleKeydown} class="w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />{/if}</td>
                <td class="px-3 py-2"><input type="number" step="any" aria-label={m.data_amount()} bind:value={editAmount} placeholder={m.data_withholding_amount_hint()} title={m.data_withholding_amount_hint()} onkeydown={handleKeydown} class="w-full rounded border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" /></td>
                <td class="px-3 py-2">{#if row.dividendId !== undefined}<span class="text-slate-500 dark:text-slate-400">{editCurrency}</span>{:else}<input type="text" aria-label={m.data_currency()} bind:value={editCurrency} onkeydown={handleKeydown} class="w-20 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />{/if}</td>
                <td class="px-3 py-2">
                  <div class="flex gap-1">
                    <button onclick={saveEdit} class="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700">{m.data_save()}</button>
                    {#if editError}<span class="self-center text-xs text-red-500">{editError}</span>{/if}
                    <button onclick={() => (editingId = null)} class="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">{m.data_cancel()}</button>
                  </div>
                </td>
              </tr>
            {:else}
              <tr class="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                  {row.symbol}
                  {#if row.dividendId !== undefined}
                    <span class="ml-1 inline-block align-middle text-slate-400" title={m.data_withholding_linked()}>
                      <Link size={12} aria-label={m.data_withholding_linked()} />
                    </span>
                  {/if}
                </td>
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
