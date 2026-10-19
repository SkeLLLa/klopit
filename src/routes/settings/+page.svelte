<script lang="ts">
  import { Info } from '@lucide/svelte';
  import DeleteConfirm from '#lib/components/DeleteConfirm.svelte';
  import { db } from '#lib/db.js';
  import { m } from '#lib/paraglide/messages.js';
  import {
    BackupError,
    exportBackup,
    importBackup,
    readBackupFile,
    type BackupFile,
    type BackupErrorCode,
  } from '#lib/services/backup.js';
  import { localizeHref } from '#lib/paraglide/runtime.js';
  import { pageTitle } from '#lib/state/page-title.svelte.js';
  import { calculateSessionTaxes } from '#lib/services/tax.js';
  import { sessionState } from '#lib/state/session.svelte.js';
  import { updateSession } from '#lib/services/session.js';
  import { useSessionBootstrap } from '#lib/utils/use-session-bootstrap.svelte.js';
  import {
    LOG_LEVELS,
    loggerState,
    type LogLevel,
  } from '#lib/state/logger.svelte.js';

  pageTitle.set(m.settings_title());

  function handleLogLevelChange(e: Event) {
    const target = e.currentTarget as HTMLSelectElement;
    loggerState.setLevel(target.value as LogLevel);
  }

  const bootstrap = useSessionBootstrap();
  const sessions = $derived(bootstrap.sessions);
  const session = $derived(bootstrap.activeSession);
  const activeSessionId = $derived(bootstrap.activeSessionId);
  const showDividendsInPitZg = $derived(session?.showDividendsInPitZg ?? false);
  const reduceAdrFeesFromDividends = $derived(
    session?.reduceAdrFeesFromDividends ?? false,
  );
  const useSettlementDateForTradeRates = $derived(
    session?.useSettlementDateForTradeRates ?? false,
  );
  let saving = $state(false);
  let error: string | null = $state(null);

  function handleSessionChange(e: Event) {
    const target = e.currentTarget as HTMLSelectElement;
    sessionState.setActiveSession(target.value);
  }

  async function persistSessionSetting(
    changes: Parameters<typeof updateSession>[0]['changes'],
  ) {
    if (!session) return;
    saving = true;
    error = null;
    try {
      await updateSession({
        id: session.id,
        changes: {
          ...changes,
          dataUpdatedAt: new Date(),
        },
      });
      if (session.status === 'calculated') {
        await calculateSessionTaxes({ sessionId: session.id });
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      saving = false;
    }
  }

  let backupFileInput: HTMLInputElement | undefined = $state(undefined);
  let backupBusy = $state(false);
  let backupError: string | null = $state(null);
  let backupMessage: string | null = $state(null);
  let pendingBackup: BackupFile | null = $state(null);

  const BACKUP_ERROR_MESSAGES: Record<BackupErrorCode, () => string> = {
    corrupt: () => m.settings_backup_error_corrupt(),
    format: () => m.settings_backup_error_format(),
    formatVersion: () => m.settings_backup_error_format_version(),
    schemaNewer: () => m.settings_backup_error_schema_newer(),
    schemaOlder: () => m.settings_backup_error_schema_older(),
    tooLarge: () => m.settings_backup_error_too_large(),
    invalid: () => m.settings_backup_error_invalid(),
  };

  function describeBackupError(e: unknown): string {
    if (e instanceof BackupError) return BACKUP_ERROR_MESSAGES[e.code]();
    return m.settings_backup_error_generic({
      error: e instanceof Error ? e.message : String(e),
    });
  }

  async function handleBackupExport() {
    backupBusy = true;
    backupError = null;
    backupMessage = null;
    try {
      const text = await exportBackup({ appVersion: __APP_VERSION__ });
      const url = URL.createObjectURL(
        new Blob([text], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `klopit-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      backupError = describeBackupError(e);
    } finally {
      backupBusy = false;
    }
  }

  async function handleBackupFileChosen(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    backupError = null;
    backupMessage = null;
    if (!file) return;
    backupBusy = true;
    try {
      // Validate before asking, so a bad file never reaches the confirmation.
      pendingBackup = await readBackupFile(file);
    } catch (err) {
      backupError = describeBackupError(err);
    } finally {
      backupBusy = false;
    }
  }

  async function handleBackupConfirm() {
    const backup = pendingBackup;
    pendingBackup = null;
    if (backup === null) return;
    backupBusy = true;
    try {
      await importBackup({ backup });
      // Re-resolve the active session; falls back to the first one when the
      // previous id is no longer in the restored data.
      sessionState.init(
        // oxlint-disable-next-line unicorn/no-array-reverse -- Dexie Collection#reverse(), not Array#reverse()
        await db.sessions.orderBy('year').reverse().toArray(),
      );
      backupMessage = m.settings_backup_success();
    } catch (e) {
      backupError = describeBackupError(e);
    } finally {
      backupBusy = false;
    }
  }

  async function handlePitZgToggle() {
    await persistSessionSetting({
      showDividendsInPitZg: !showDividendsInPitZg,
    });
  }

  async function handleAdrFeesToggle() {
    await persistSessionSetting({
      reduceAdrFeesFromDividends: !reduceAdrFeesFromDividends,
    });
  }

  async function handleTradeRateDateToggle() {
    await persistSessionSetting({
      useSettlementDateForTradeRates: !useSettlementDateForTradeRates,
    });
  }
</script>

<h1 class="sr-only">{m.settings_title()}</h1>

<div class="space-y-5">
  <div class="space-y-2">
    <h2 class="text-2xl font-bold text-slate-900 dark:text-slate-100">
      {m.settings_title()}
    </h2>
    {#if sessions.length > 0}
      <div class="flex items-center gap-3">
        <label
          for="settings-session-select"
          class="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          {m.data_session_label()}
        </label>
        <select
          id="settings-session-select"
          value={activeSessionId}
          onchange={handleSessionChange}
          class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          {#each sessions as item (item.id)}
            <option value={item.id}>{item.year}</option>
          {/each}
        </select>
      </div>
    {/if}
  </div>

  <div class="grid gap-4 lg:grid-cols-2">
    {#if !session}
      <div
        class="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400 lg:col-span-2"
      >
        {m.prior_losses_no_session()}
      </div>
    {:else}
      <section
        class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
      >
        <div class="space-y-3">
          <div>
            <h3 class="text-base font-semibold text-slate-900 dark:text-slate-100">
              {m.settings_pitzg_title()}
            </h3>
            <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {m.settings_title()} ({session.year})
            </p>
          </div>

          <label class="flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={showDividendsInPitZg}
              onchange={handlePitZgToggle}
              disabled={saving}
              class="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
            />
            <span class="text-sm font-medium text-slate-800 dark:text-slate-200">
              {m.settings_pitzg_toggle_label()}
            </span>
          </label>

          <p class="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {showDividendsInPitZg
              ? m.settings_pitzg_description_on()
              : m.settings_pitzg_description_off()}
          </p>
          {#if error}
            <p class="text-xs text-red-600 dark:text-red-400">
              {m.tax_error_calculation({ error })}
            </p>
          {/if}
          {#if saving}
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {m.tax_calculating()}
            </p>
          {/if}

          <div
            class="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-2 text-xs leading-relaxed text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200"
          >
            <div class="flex items-start gap-2">
              <Info size={13} class="mt-0.5 shrink-0" />
              <div class="space-y-1.5">
                <p>{m.settings_pitzg_tooltip()}</p>
                <a
                  href={localizeHref('/docs/pit-zg')}
                  class="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline dark:text-blue-300"
                >
                  {m.tax_pitzg_learn_more()}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
      >
        <div class="space-y-3">
          <div>
            <h3 class="text-base font-semibold text-slate-900 dark:text-slate-100">
              {m.settings_adr_fees_title()}
            </h3>
            <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {m.settings_adr_fees_summary()}
            </p>
          </div>

          <label class="flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={reduceAdrFeesFromDividends}
              onchange={handleAdrFeesToggle}
              disabled={saving}
              class="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
            />
            <span class="text-sm font-medium text-slate-800 dark:text-slate-200">
              {m.settings_adr_fees_toggle_label()}
            </span>
          </label>

          <p class="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {reduceAdrFeesFromDividends
              ? m.settings_adr_fees_description_on()
              : m.settings_adr_fees_description_off()}
          </p>

          <div
            class="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          >
            <div class="flex items-start gap-2">
              <Info size={13} class="mt-0.5 shrink-0" />
              <p>{m.settings_adr_fees_tooltip()}</p>
            </div>
          </div>
        </div>
      </section>

      <section
        class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
      >
        <div class="space-y-3">
          <div>
            <h3 class="text-base font-semibold text-slate-900 dark:text-slate-100">
              {m.settings_trade_rates_title()}
            </h3>
            <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {m.settings_trade_rates_summary()}
            </p>
          </div>

          <label class="flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={useSettlementDateForTradeRates}
              onchange={handleTradeRateDateToggle}
              disabled={saving}
              class="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
            />
            <span class="text-sm font-medium text-slate-800 dark:text-slate-200">
              {m.settings_trade_rates_toggle_label()}
            </span>
          </label>

          <p class="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {useSettlementDateForTradeRates
              ? m.settings_trade_rates_description_on()
              : m.settings_trade_rates_description_off()}
          </p>

          <div
            class="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          >
            <div class="flex items-start gap-2">
              <Info size={13} class="mt-0.5 shrink-0" />
              <div class="space-y-1.5">
                <p>{m.settings_trade_rates_tooltip()}</p>
                <a
                  href={localizeHref('/docs/trade-vs-settlement-date')}
                  class="inline-flex items-center gap-1 font-medium text-amber-800 hover:underline dark:text-amber-200"
                >
                  {m.tax_pitzg_learn_more()}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    {/if}

    <section
      class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
    >
      <div class="space-y-3">
        <div>
          <h3 class="text-base font-semibold text-slate-900 dark:text-slate-100">
            {m.settings_backup_title()}
          </h3>
          <p class="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {m.settings_backup_description()}
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            onclick={handleBackupExport}
            disabled={backupBusy}
            class="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {m.settings_backup_export()}
          </button>
          <button
            type="button"
            onclick={() => backupFileInput?.click()}
            disabled={backupBusy}
            class="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {m.settings_backup_import()}
          </button>
          <input
            bind:this={backupFileInput}
            type="file"
            accept="application/json,.json"
            class="hidden"
            tabindex="-1"
            aria-hidden="true"
            onchange={handleBackupFileChosen}
          />
        </div>

        <div role="status" aria-live="polite">
          {#if backupMessage}
            <p class="text-xs text-green-700 dark:text-green-400">{backupMessage}</p>
          {/if}
        </div>
        {#if backupError}
          <p role="alert" class="text-xs text-red-600 dark:text-red-400">
            {backupError}
          </p>
        {/if}
      </div>
    </section>

    <DeleteConfirm
      message={m.settings_backup_confirm()}
      open={pendingBackup !== null}
      onconfirm={handleBackupConfirm}
      oncancel={() => (pendingBackup = null)}
    />

    <section
      class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
    >
      <div class="space-y-3">
        <div>
          <h3 class="text-base font-semibold text-slate-900 dark:text-slate-100">
            {m.settings_logging_title()}
          </h3>
          <p class="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {m.settings_logging_description()}
          </p>
        </div>

        <label class="flex items-center gap-3">
          <span class="text-sm font-medium text-slate-800 dark:text-slate-200">
            {m.settings_logging_level_label()}
          </span>
          <select
            value={loggerState.level}
            onchange={handleLogLevelChange}
            class="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            {#each LOG_LEVELS as lvl (lvl)}
              <option value={lvl}>{lvl}</option>
            {/each}
          </select>
        </label>
      </div>
    </section>
  </div>
</div>
