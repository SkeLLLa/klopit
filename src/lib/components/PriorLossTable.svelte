<script lang="ts">
  import { Pencil, Trash2, Plus } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import DeleteConfirm from '$lib/components/DeleteConfirm.svelte';
  import { db, type PriorYearLossRecord } from '$lib/db.js';
  import { useLiveQuery } from '$lib/utils/live-query.svelte.js';
  import {
    addPriorYearLoss,
    deletePriorYearLoss,
    updatePriorYearLoss,
  } from '$lib/services/data.js';

  let { sessionId, sessionYear }: { sessionId: string; sessionYear: number } =
    $props();

  const records = useLiveQuery(() =>
    db.priorLosses.where('sessionId').equals(sessionId).sortBy('year'),
  );

  let editingId: number | null = $state(null);
  let editYear = $state('');
  let editTotal = $state('');
  let editDeducted = $state('');
  let deleteTarget: PriorYearLossRecord | null = $state(null);

  // Defaults for the "add new" inline row.
  // sessionYear is a prop and may change as the user switches sessions —
  // wrap the default year in a derived so the input updates accordingly
  // until the user types something else.
  const defaultNewYear = $derived(String(sessionYear - 1));
  let newYear = $state('');
  $effect(() => {
    if (!newYear) newYear = defaultNewYear;
  });
  let newTotal = $state('');
  let newDeducted = $state('0');

  function startEdit(row: PriorYearLossRecord) {
    editingId = row.id ?? null;
    editYear = String(row.year);
    editTotal = String(row.totalLossPln);
    editDeducted = String(row.alreadyDeductedPln);
  }

  async function saveEdit() {
    if (editingId === null) return;
    await updatePriorYearLoss({
      id: editingId,
      changes: {
        year: parseInt(editYear, 10),
        totalLossPln: parseFloat(editTotal),
        alreadyDeductedPln: parseFloat(editDeducted) || 0,
      },
    });
    editingId = null;
  }

  async function handleAdd() {
    const total = parseFloat(newTotal);
    const year = parseInt(newYear, 10);
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(year)) return;
    await addPriorYearLoss({
      sessionId,
      loss: {
        year,
        totalLossPln: total,
        alreadyDeductedPln: parseFloat(newDeducted) || 0,
      },
    });
    newYear = defaultNewYear;
    newTotal = '';
    newDeducted = '0';
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    await deletePriorYearLoss({ id: deleteTarget.id });
    deleteTarget = null;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') void saveEdit();
    if (e.key === 'Escape') editingId = null;
  }

  function handleAddKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') void handleAdd();
  }

  function remaining(row: PriorYearLossRecord): number {
    return Math.max(row.totalLossPln - row.alreadyDeductedPln, 0);
  }

  function fmt(n: number): string {
    return n.toLocaleString('pl-PL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
</script>

<div class="space-y-3">
  <div class="overflow-x-auto">
    <table class="w-full text-left text-sm">
      <thead>
        <tr
          class="border-b border-slate-200 text-xs font-medium uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400"
        >
          <th class="px-3 py-2">{m.prior_losses_year()}</th>
          <th class="px-3 py-2 text-right">{m.prior_losses_total_loss()}</th>
          <th class="px-3 py-2 text-right">
            {m.prior_losses_already_deducted()}
          </th>
          <th class="px-3 py-2 text-right">{m.prior_losses_remaining()}</th>
          <th class="px-3 py-2">{m.data_actions()}</th>
        </tr>
      </thead>
      <tbody>
        {#if !records.current || records.current.length === 0}
          <tr>
            <td
              colspan="5"
              class="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400"
            >
              {m.prior_losses_empty()}
            </td>
          </tr>
        {:else}
          {#each records.current as row (row.id)}
            {#if editingId === row.id}
              <tr class="border-b border-slate-100 dark:border-slate-800">
                <td class="px-3 py-2">
                  <input
                    type="number"
                    aria-label={m.prior_losses_year()}
                    bind:value={editYear}
                    onkeydown={handleKeydown}
                    class="w-24 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  />
                </td>
                <td class="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    aria-label={m.prior_losses_total_loss()}
                    bind:value={editTotal}
                    onkeydown={handleKeydown}
                    class="w-full rounded border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  />
                </td>
                <td class="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    aria-label={m.prior_losses_already_deducted()}
                    bind:value={editDeducted}
                    onkeydown={handleKeydown}
                    class="w-full rounded border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  />
                </td>
                <td
                  class="px-3 py-2 text-right tabular-nums text-slate-500 dark:text-slate-400"
                >
                  {fmt(
                    Math.max(
                      parseFloat(editTotal || '0') -
                        parseFloat(editDeducted || '0'),
                      0,
                    ),
                  )}
                </td>
                <td class="px-3 py-2">
                  <div class="flex gap-1">
                    <button
                      onclick={() => void saveEdit()}
                      class="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                    >
                      {m.data_save()}
                    </button>
                    <button
                      onclick={() => (editingId = null)}
                      class="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      {m.data_cancel()}
                    </button>
                  </div>
                </td>
              </tr>
            {:else}
              <tr
                class="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
              >
                <td
                  class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100"
                >
                  {row.year}
                </td>
                <td
                  class="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300"
                >
                  {fmt(row.totalLossPln)}
                </td>
                <td
                  class="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-400"
                >
                  {fmt(row.alreadyDeductedPln)}
                </td>
                <td
                  class="px-3 py-2 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100"
                >
                  {fmt(remaining(row))}
                </td>
                <td class="px-3 py-2">
                  <div class="flex gap-1">
                    <button
                      onclick={() => startEdit(row)}
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
        {/if}

        <!-- Inline "add" row -->
        <tr class="border-b border-slate-100 dark:border-slate-800">
          <td class="px-3 py-2">
            <input
              type="number"
              aria-label={m.prior_losses_year()}
              bind:value={newYear}
              onkeydown={handleAddKeydown}
              class="w-24 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            />
          </td>
          <td class="px-3 py-2 text-right">
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              aria-label={m.prior_losses_total_loss()}
              bind:value={newTotal}
              onkeydown={handleAddKeydown}
              class="w-full rounded border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            />
          </td>
          <td class="px-3 py-2 text-right">
            <input
              type="number"
              step="0.01"
              aria-label={m.prior_losses_already_deducted()}
              bind:value={newDeducted}
              onkeydown={handleAddKeydown}
              class="w-full rounded border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            />
          </td>
          <td></td>
          <td class="px-3 py-2">
            <button
              onclick={() => void handleAdd()}
              class="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
            >
              <Plus size={12} />
              {m.prior_losses_add()}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <DeleteConfirm
    open={deleteTarget !== null}
    message={m.data_delete_row_confirm()}
    onconfirm={() => void handleDelete()}
    oncancel={() => (deleteTarget = null)}
  />
</div>
