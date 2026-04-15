<script lang="ts">
  import { X } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import type { SkippedRow } from '../../core/types.js';

  let {
    row,
    onclose,
  }: {
    row: SkippedRow | null;
    onclose: () => void;
  } = $props();

  const messages = m as unknown as Record<
    string,
    (inputs?: Record<string, string>) => string
  >;
  function t(key: string, fallback: string): string {
    return messages[key]?.() ?? fallback;
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }

  function kindLabel(kind: SkippedRow['kind']): string {
    switch (kind) {
      case 'known-unsupported':
        return t('data_skipped_kind_known_unsupported', 'Known unsupported');
      case 'unknown':
        return t('data_skipped_kind_unknown', 'Unknown');
      case 'parse-failure':
        return t('data_skipped_kind_parse_failure', 'Parse failure');
    }
  }
</script>

{#if row}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div
      class="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800"
      role="document"
    >
      <div class="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
              {row.section}
            </span>
            <span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              {kindLabel(row.kind)}
            </span>
            {#if row.line}
              <span class="text-xs text-slate-500 dark:text-slate-400">
                {t('data_skipped_col_line', 'Line')}: {row.line}
              </span>
            {/if}
          </div>
        </div>
        <button
          onclick={onclose}
          class="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          aria-label={t('data_cancel', 'Cancel')}
        >
          <X size={18} />
        </button>
      </div>

      <div class="max-h-[60vh] space-y-4 overflow-auto p-4">
        {#if row.rawLine}
          <div>
            <p class="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('data_skipped_raw_line_title', 'Raw CSV line')}
            </p>
            <pre class="overflow-x-auto rounded bg-slate-100 p-3 font-mono text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-200">
{row.rawLine}</pre>
          </div>
        {:else}
          <div
            class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
          >
            {t(
              'data_skipped_empty_after_reload',
              'Detailed row data is only available during the import session. Re-import the file to inspect individual rows.',
            )}
          </div>
        {/if}

        <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('data_skipped_col_section', 'Section')}
            </dt>
            <dd class="font-mono text-slate-900 dark:text-slate-100">{row.section}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('data_skipped_col_kind', 'Kind')}
            </dt>
            <dd class="text-slate-900 dark:text-slate-100">{kindLabel(row.kind)}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('data_skipped_col_symbol', 'Symbol')}
            </dt>
            <dd class="font-mono text-slate-900 dark:text-slate-100">{row.symbol ?? '—'}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('data_skipped_col_description', 'Description')}
            </dt>
            <dd class="text-slate-900 dark:text-slate-100">{row.description ?? '—'}</dd>
          </div>
        </dl>
      </div>
    </div>
  </div>
{/if}
