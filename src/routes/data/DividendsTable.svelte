<!-- src/routes/data/DividendsTable.svelte -->
<script lang="ts">
  import { Pencil, Trash2, Plus } from '@lucide/svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { db, type DividendRecord } from '#lib/db.js';
  import { useLiveQuery } from '#lib/utils/live-query.svelte.js';
  import { saveDividend, deleteDividend, listDividendWithholding } from '#lib/services/data.js';
  import { resolveDividendCountry } from '#lib/services/country-overrides.js';
  import { formatDate } from '#lib/utils/format-date.js';
  import MissingIsinLookup from '#lib/components/ui/MissingIsinLookup.svelte';
  import DividendForm, { type DividendFormResult } from './DividendForm.svelte';
  import { dividendMatchKey } from '../../core/tax/dividends.js';
  import DeleteConfirm from '#lib/components/DeleteConfirm.svelte';
  import EmptyState from './EmptyState.svelte';

  let { sessionId, sessionYear }: { sessionId: string; sessionYear?: number | undefined } = $props();

  const dividends = useLiveQuery(() =>
    db.dividends.where('sessionId').equals(sessionId).sortBy('date'),
  );

  const withholding = useLiveQuery(() => listDividendWithholding({ sessionId }));

  const linked = (id: number | undefined) =>
    id === undefined ? undefined : withholding.current?.linkedByDividendId.get(id);
  const isImported = (row: DividendRecord) =>
    withholding.current?.unlinkedKeys.has(dividendMatchKey(row)) ?? false;
  const isLocked = (key: string) => withholding.current?.unlinkedKeys.has(key) ?? false;
  const countryOf = (symbol: string, isin: string) =>
    resolveDividendCountry({ sessionId, symbol, isin });

  let showAddForm = $state(false);
  let editingId: number | null = $state(null);
  let deleteTarget: DividendRecord | null = $state(null);

  async function handleAdd(result: DividendFormResult) {
    await saveDividend({ sessionId, ...result });
    showAddForm = false;
  }

  async function handleUpdate(id: number, result: DividendFormResult) {
    await saveDividend({ sessionId, id, ...result });
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
      <DividendForm defaultYear={sessionYear} withholdingLocked={isLocked} resolveCountry={countryOf} onsave={handleAdd} oncancel={() => (showAddForm = false)} />
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
            <th class="px-3 py-2 text-right">{m.data_dividend_withheld_column()}</th>
            <th class="px-3 py-2">{m.data_actions()}</th>
          </tr>
        </thead>
        <tbody>
          {#each dividends.current as row (row.id)}
            {#if editingId === row.id}
              <tr>
                <td colspan="7" class="p-2">
                  {#key editingId}
                    <DividendForm
                      initial={row}
                      initialWithholding={linked(row.id) ? -(linked(row.id)?.amount ?? 0) : undefined}
                      withholdingLocked={isLocked}
                      resolveCountry={countryOf}
                      onsave={(result) => handleUpdate(row.id as number, result)}
                      oncancel={() => (editingId = null)}
                    />
                  {/key}
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
                <td class="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                  {#if linked(row.id)}
                    {(-(linked(row.id)?.amount ?? 0)).toFixed(2)}
                  {:else if isImported(row)}
                    <span class="text-xs text-slate-500 dark:text-slate-400">{m.data_dividend_withheld_imported()}</span>
                  {/if}
                </td>
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
