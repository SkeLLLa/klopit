<!-- src/routes/data/CarryInTable.svelte -->
<script lang="ts">
  import { AlertTriangle, Pencil, Plus, Trash2 } from '@lucide/svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { db, type CarryInPositionRecord } from '#lib/db.js';
  import { useLiveQuery } from '#lib/utils/live-query.svelte.js';
  import { formatDate } from '#lib/utils/format-date.js';
  import {
    addCarryInPosition,
    updateCarryInPosition,
    deleteCarryInPosition,
  } from '#lib/services/data.js';
  import {
    CarryInValidationError,
    isCarryInCostMissing,
    isCarryInIgnored,
    parseDecimalInput,
    type CarryInValidationCode,
  } from '#lib/services/carry-in.js';
  import { listSessionAccounts } from '#lib/services/accounts.js';
  import AccountField from './AccountField.svelte';
  import { formatAccount } from '#lib/utils/account.js';
  import MissingIsinLookup from '#lib/components/ui/MissingIsinLookup.svelte';
  import DeleteConfirm from '#lib/components/DeleteConfirm.svelte';
  import EmptyState from './EmptyState.svelte';
  import type { CarryInPosition } from '../../core/types.js';

  let { sessionId, sessionYear }: { sessionId: string; sessionYear: number } = $props();
  const uid = $props.id();
  const errorId = `${uid}-error`;

  const records = useLiveQuery(() =>
    db.carryInPositions.where('sessionId').equals(sessionId).sortBy('symbol'),
  );
  const accounts = useLiveQuery(() => listSessionAccounts({ sessionId }));
  // Warnings from the last calculation: rows it did not use need no cost.
  const carryInWarnings = useLiveQuery(
    async () => (await db.taxSummaries.get(sessionId))?.carryInWarnings ?? [],
  );

  // Currencies offered for the cost basis: PLN plus every session trade currency.
  const sessionCurrencies = useLiveQuery(async () => {
    const trades = await db.trades.where('sessionId').equals(sessionId).toArray();
    const set = new Set<string>(['PLN']);
    for (const t of trades) set.add(t.currency.toUpperCase());
    return [...set].toSorted();
  });

  // `null` = no editor open, `'new'` = adding a row, number = editing that id.
  let editingId: number | 'new' | null = $state(null);
  let editSymbol = $state('');
  let editIsin = $state('');
  let editQuantity = $state('');
  let editYear = $state('');
  let editAcquisitionDate = $state('');
  let editCostBasis = $state('');
  let editCurrency = $state('');
  const showAccount = $derived((accounts.current?.length ?? 0) > 0 || editingId !== null);
  let editZeroConfirmed = $state(false);
  let editAccount: string | undefined = $state(undefined);
  let editError = $state('');
  type EditField = 'symbol' | 'quantity' | 'year' | 'date' | 'cost';
  let editErrorField: EditField | null = $state(null);
  let deleteTarget: CarryInPositionRecord | null = $state(null);

  const currencyOptions = $derived.by(() => {
    const options = sessionCurrencies.current ?? ['PLN'];
    return editCurrency && !options.includes(editCurrency) ? [...options, editCurrency] : options;
  });

  function toDateInput(d: Date | undefined): string {
    if (!d) return '';
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${String(d.getFullYear())}-${month}-${day}`;
  }

  function fillEditor(row?: CarryInPositionRecord) {
    editError = '';
    editErrorField = null;
    editSymbol = row?.symbol ?? '';
    editIsin = row?.isin ?? '';
    editQuantity = row ? String(row.quantity) : '';
    editYear = String(row?.year ?? sessionYear - 1);
    editAcquisitionDate = toDateInput(row?.acquisitionDate);
    editCostBasis = row?.costBasis === undefined ? '' : String(row.costBasis);
    editCurrency = row?.currency ?? 'PLN';
    editZeroConfirmed = row?.costBasisSource === 'zero-confirmed';
    const known = accounts.current ?? [];
    editAccount = row ? row.account : known.length === 1 ? known[0] : undefined;
  }

  function startEdit(row: CarryInPositionRecord) {
    fillEditor(row);
    editingId = row.id as number;
  }

  function startAdd() {
    fillEditor();
    editingId = 'new';
  }

  // Inputs are text (inputmode=decimal) so "1 234,5" works; parse explicitly.
  function buildChanges(): CarryInPosition {
    const costBasis = parseDecimalInput(editCostBasis);
    if (costBasis !== undefined && Number.isNaN(costBasis)) {
      throw new CarryInValidationError('cost-invalid');
    }
    return {
      symbol: editSymbol,
      isin: editIsin.trim() || undefined,
      quantity: parseDecimalInput(editQuantity) ?? Number.NaN,
      year: Number(editYear.trim() || Number.NaN),
      acquisitionDate: editAcquisitionDate ? new Date(`${editAcquisitionDate}T00:00:00`) : undefined,
      costBasis,
      currency: editCurrency || undefined,
      // Normalized server-side: a cost (or PLN override) makes it 'user'.
      costBasisSource: editZeroConfirmed ? 'zero-confirmed' : 'missing',
      account: editAccount,
    };
  }

  const ERROR_FIELDS: Record<CarryInValidationCode, EditField> = {
    'symbol-required': 'symbol',
    'quantity-invalid': 'quantity',
    'year-invalid': 'year',
    'year-not-prior': 'year',
    'date-after-year': 'date',
    'cost-invalid': 'cost',
    'date-required-for-fx': 'date',
  };

  /** ARIA attributes marking the input that caused the validation error. */
  function invalidAttrs(field: EditField) {
    return editErrorField === field
      ? { 'aria-invalid': true, 'aria-describedby': errorId }
      : {};
  }

  // Focus the first input when the editor opens.
  function focusOnMount(node: HTMLElement) {
    node.focus();
  }

  function errorMessage(e: unknown): string {
    if (!(e instanceof CarryInValidationError)) return e instanceof Error ? e.message : String(e);
    switch (e.code) {
      case 'symbol-required':
        return m.data_carry_in_error_symbol_required();
      case 'quantity-invalid':
        return m.data_carry_in_error_quantity_invalid();
      case 'year-invalid':
        return m.data_carry_in_error_year_invalid();
      case 'year-not-prior':
        return m.data_carry_in_error_year_not_prior({ year: String(sessionYear) });
      case 'date-after-year':
        return m.data_carry_in_error_date_after_year();
      case 'cost-invalid':
        return m.data_carry_in_error_cost_invalid();
      case 'date-required-for-fx':
        return m.data_carry_in_error_date_required_for_fx();
    }
  }

  async function saveEdit() {
    if (editingId === null) return;
    try {
      const position = buildChanges();
      if (editingId === 'new') {
        await addCarryInPosition({ sessionId, position });
      } else {
        await updateCarryInPosition({ id: editingId, changes: position });
      }
      editingId = null;
    } catch (e) {
      editError = errorMessage(e);
      editErrorField = e instanceof CarryInValidationError ? ERROR_FIELDS[e.code] : null;
    }
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    await deleteCarryInPosition({ id: deleteTarget.id });
    deleteTarget = null;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') void saveEdit();
    if (e.key === 'Escape') editingId = null;
  }

  const inputClass =
    'w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200';
</script>

{#snippet editorRow()}
  <tr class="border-b border-slate-100 dark:border-slate-800">
    <td class="px-3 py-2"><input type="text" aria-label={m.data_symbol()} {...invalidAttrs('symbol')} bind:value={editSymbol} onkeydown={handleKeydown} class={inputClass} {@attach focusOnMount} /></td>
    <td class="px-3 py-2"><input type="text" aria-label={m.data_isin()} bind:value={editIsin} onkeydown={handleKeydown} class={inputClass} /></td>
    <td class="px-3 py-2"><input type="text" inputmode="decimal" aria-label={m.data_quantity()} {...invalidAttrs('quantity')} bind:value={editQuantity} onkeydown={handleKeydown} class="{inputClass} text-right" /></td>
    <td class="px-3 py-2"><input type="text" inputmode="numeric" aria-label={m.data_year()} {...invalidAttrs('year')} bind:value={editYear} onkeydown={handleKeydown} class="{inputClass} w-24" /></td>
    <td class="px-3 py-2"><input type="date" aria-label={m.data_acquisition_date()} {...invalidAttrs('date')} bind:value={editAcquisitionDate} onkeydown={handleKeydown} class={inputClass} /></td>
    <td class="px-3 py-2"><input type="text" inputmode="decimal" aria-label={m.data_cost_basis()} {...invalidAttrs('cost')} bind:value={editCostBasis} onkeydown={handleKeydown} class="{inputClass} text-right" /></td>
    <td class="px-3 py-2">
      <select aria-label={m.data_currency()} bind:value={editCurrency} class={inputClass}>
        {#each currencyOptions as currency (currency)}
          <option value={currency}>{currency}</option>
        {/each}
      </select>
    </td>
    {#if showAccount}
      <td class="px-3 py-2"><AccountField id="carry-in-account" accounts={accounts.current ?? []} value={editAccount} onchange={(v) => (editAccount = v)} compact /></td>
    {/if}
    <td class="px-3 py-2">
      <label class="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300" title={m.data_cost_zero_hint()}>
        <input type="checkbox" bind:checked={editZeroConfirmed} />
        {m.data_cost_zero_confirmed()}
      </label>
    </td>
    <td class="px-3 py-2">
      <div class="flex gap-1">
        <button onclick={() => void saveEdit()} class="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700">{m.data_save()}</button>
        <button onclick={() => (editingId = null)} class="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">{m.data_cancel()}</button>
      </div>
    </td>
  </tr>
  {#if editError}
    <tr class="border-b border-slate-100 dark:border-slate-800">
      <td colspan="10" class="px-3 pb-2">
        <p id={errorId} role="alert" class="text-xs text-red-600 dark:text-red-400">{editError}</p>
      </td>
    </tr>
  {/if}
{/snippet}

<div>
  <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
    <div class="space-y-1 text-xs text-slate-500 dark:text-slate-400">
      <p>{m.data_carry_in_split_hint()}</p>
      <p>{m.data_cost_zero_hint()}</p>
    </div>
    {#if editingId !== 'new'}
      <button
        onclick={startAdd}
        class="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus size={14} />
        {m.data_add_carry_in()}
      </button>
    {/if}
  </div>

  {#if (!records.current || records.current.length === 0) && editingId !== 'new'}
    <EmptyState message={m.data_empty_carry_in()} />
  {:else}
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-slate-200 text-xs font-medium uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <th class="px-3 py-2">{m.data_symbol()}</th>
            <th class="px-3 py-2">{m.data_isin()}</th>
            <th class="px-3 py-2 text-right">{m.data_quantity()}</th>
            <th class="px-3 py-2">{m.data_year()}</th>
            <th class="px-3 py-2">{m.data_acquisition_date()}</th>
            <th class="px-3 py-2 text-right">{m.data_cost_basis()}</th>
            <th class="px-3 py-2">{m.data_currency()}</th>
            {#if showAccount}<th class="px-3 py-2">{m.data_account()}</th>{/if}
            <th class="px-3 py-2">{m.data_cost_status()}</th>
            <th class="px-3 py-2">{m.data_actions()}</th>
          </tr>
        </thead>
        <tbody>
          {#if editingId === 'new'}
            {@render editorRow()}
          {/if}
          {#each records.current ?? [] as row (row.id)}
            {#if editingId === row.id}
              {@render editorRow()}
            {:else}
              {@const ignored = isCarryInIgnored(row, carryInWarnings.current ?? [])}
              {@const costMissing = !ignored && isCarryInCostMissing(row)}
              <tr class="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 {costMissing ? 'bg-amber-50 dark:bg-amber-900/20' : ''}">
                <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{row.symbol}</td>
                <td class="px-3 py-2 text-slate-500 dark:text-slate-400">
                  {#if row.isin}
                    {row.isin}
                  {:else}
                    <MissingIsinLookup symbol={row.symbol} />
                  {/if}
                </td>
                <td class="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">{row.quantity}</td>
                <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{row.year}</td>
                <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{row.acquisitionDate ? formatDate(row.acquisitionDate) : '—'}</td>
                <td class="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">{row.costBasisPln ?? row.costBasis ?? '—'}</td>
                <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{row.costBasisPln === undefined ? (row.currency ?? '—') : 'PLN'}</td>
                {#if showAccount}
                  <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{row.account ? formatAccount(row.account) : ''}</td>
                {/if}
                <td class="px-3 py-2 text-xs">
                  {#if ignored}
                    <span class="text-slate-500 dark:text-slate-400">{m.data_cost_status_ignored()}</span>
                  {:else if costMissing}
                    <span class="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300">
                      <AlertTriangle size={12} />
                      {m.data_cost_status_missing()}
                    </span>
                  {:else if row.costBasisSource === 'zero-confirmed' && row.costBasis === undefined && row.costBasisPln === undefined}
                    <span class="text-slate-600 dark:text-slate-300">{m.data_cost_zero_confirmed()}</span>
                  {:else}
                    <span class="text-green-700 dark:text-green-400">{m.data_cost_status_ok()}</span>
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
