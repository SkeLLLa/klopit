<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { db, type SessionRecord } from '$lib/db.js';
  import { useLiveQuery } from '$lib/utils/live-query.svelte.js';
  import { skippedRowsStore } from '$lib/state/skipped-rows.svelte.js';
  import type { ImportWarning, SkippedRow } from '../../core/types.js';
  import RawRowModal from './RawRowModal.svelte';

  let { sessionId }: { sessionId: string } = $props();

  type SessionWithImportWarnings = SessionRecord & {
    importWarnings?: ImportWarning[];
  };

  type SkippedTableRow = SkippedRow & {
    rowCount?: number;
    message?: string;
  };

  const sessionQuery = useLiveQuery(() => db.sessions.get(sessionId));
  const inMemoryRows = $derived(skippedRowsStore.getSkippedRows({ sessionId }));
  const persistedWarnings = $derived(
    (sessionQuery.current as SessionWithImportWarnings | undefined)?.importWarnings ?? [],
  );

  const rows = $derived(
    inMemoryRows.length > 0
      ? inMemoryRows.map(
          (row) =>
            ({
              ...row,
              rowCount: undefined,
              message: undefined,
            }) satisfies SkippedTableRow,
        )
      : persistedWarnings.map(
          (warning) =>
            ({
              section: warning.section,
              kind: warning.kind,
              line: 0,
              assetCategory: undefined,
              currency: undefined,
              symbol: undefined,
              datetime: undefined,
              rowCount: warning.rowCount,
              message: warning.message,
              description: warning.message,
              rawLine: '',
            }) satisfies SkippedTableRow,
        ),
  );

  const hasInMemoryRows = $derived(inMemoryRows.length > 0);
  let selectedRow: SkippedTableRow | null = $state(null);

  function kindLabel(kind: SkippedRow['kind']): string {
    switch (kind) {
      case 'known-unsupported':
        return m.data_skipped_kind_known_unsupported();
      case 'unknown':
        return m.data_skipped_kind_unknown();
      case 'parse-failure':
        return m.data_skipped_kind_parse_failure();
    }
  }

  function formatValue(value?: string): string {
    return value && value.trim().length > 0 ? value : '—';
  }

  function toDetailedRow(row: SkippedTableRow | null): SkippedRow | null {
    if (!row || row.line <= 0 || row.rawLine === '') return null;
    return row;
  }
</script>

{#if rows.length > 0}
  <div class="space-y-3">
    {#if !hasInMemoryRows}
      <div class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        {m.data_skipped_empty_after_reload()}
      </div>
    {/if}

    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-slate-200 text-xs font-medium uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <th class="px-3 py-2">{m.data_skipped_col_section()}</th>
            <th class="px-3 py-2">{m.data_skipped_col_kind()}</th>
            <th class="px-3 py-2">{m.data_skipped_col_line()}</th>
            <th class="px-3 py-2">{m.data_skipped_col_asset_category()}</th>
            <th class="px-3 py-2">{m.data_skipped_col_currency()}</th>
            <th class="px-3 py-2">{m.data_skipped_col_symbol()}</th>
            <th class="px-3 py-2">{m.data_skipped_col_datetime()}</th>
            <th class="px-3 py-2">{m.data_skipped_col_description()}</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row, index (row.line > 0 ? `${row.section}::${row.line}::${index}` : `${row.section}::${row.kind}`)}
            <tr
              class="cursor-pointer border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
              onclick={() => (selectedRow = row)}
            >
              <td class="px-3 py-2 font-mono text-xs text-slate-800 dark:text-slate-200">
                {row.section}
              </td>
              <td class="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                <div class="flex flex-col gap-1">
                  <span>{kindLabel(row.kind)}</span>
                  {#if row.rowCount && row.rowCount > 1}
                    <span class="inline-flex w-fit rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      {row.rowCount}
                    </span>
                  {/if}
                </div>
              </td>
              <td class="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                {row.line > 0 ? row.line : '—'}
              </td>
              <td class="px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">
                {formatValue(row.assetCategory)}
              </td>
              <td class="px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">
                {formatValue(row.currency)}
              </td>
              <td class="px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">
                {formatValue(row.symbol)}
              </td>
              <td class="px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">
                {formatValue(row.datetime)}
              </td>
              <td class="px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                {row.description ?? ('message' in row ? row.message : undefined) ?? '—'}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
  <RawRowModal
    row={toDetailedRow(selectedRow)}
    onclose={() => (selectedRow = null)}
  />
{:else}
  <div class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
    —
  </div>
{/if}
