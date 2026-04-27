<script lang="ts">
  import { Info } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { localizeHref } from '$lib/paraglide/runtime';
  import { pageTitle } from '$lib/state/page-title.svelte.js';
  import { calculateSessionTaxes } from '$lib/services/tax.js';
  import { sessionState } from '$lib/state/session.svelte.js';
  import { updateSession } from '$lib/services/session.js';
  import { useSessionBootstrap } from '$lib/utils/use-session-bootstrap.svelte.js';
  import {
    LOG_LEVELS,
    loggerState,
    type LogLevel,
  } from '$lib/state/logger.svelte.js';

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
  let saving = $state(false);
  let error: string | null = $state(null);

  function handleSessionChange(e: Event) {
    const target = e.currentTarget as HTMLSelectElement;
    sessionState.setActiveSession(target.value);
  }

  async function handleToggle() {
    if (!session) return;
    saving = true;
    error = null;
    try {
      await updateSession({
        id: session.id,
        changes: {
          showDividendsInPitZg: !showDividendsInPitZg,
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
</script>

<h1 class="sr-only">{m.settings_title()}</h1>

<div class="space-y-6">
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

  {#if !session}
    <div
      class="rounded-lg border border-dashed border-slate-300 px-4 py-10 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400"
    >
      {m.prior_losses_no_session()}
    </div>
  {:else}
    <section
      class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800"
    >
      <div class="space-y-4">
        <div>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {m.settings_pitzg_title()}
          </h3>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {m.settings_title()} ({session.year})
          </p>
        </div>

        <label class="flex items-center gap-3">
          <input
            type="checkbox"
            checked={showDividendsInPitZg}
            onchange={handleToggle}
            disabled={saving}
            class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
          />
          <span class="text-sm font-medium text-slate-800 dark:text-slate-200">
            {m.settings_pitzg_toggle_label()}
          </span>
        </label>

        <p class="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {showDividendsInPitZg
            ? m.settings_pitzg_description_on()
            : m.settings_pitzg_description_off()}
        </p>
        {#if error}
          <p class="text-sm text-red-600 dark:text-red-400">
            {m.tax_error_calculation({ error })}
          </p>
        {/if}
        {#if saving}
          <p class="text-sm text-slate-500 dark:text-slate-400">
            {m.tax_calculating()}
          </p>
        {/if}

        <div
          class="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200"
        >
          <div class="flex items-start gap-2">
            <Info size={14} class="mt-0.5 shrink-0" />
            <div class="space-y-2">
              <p>{m.settings_pitzg_tooltip()}</p>
              <a
                href={localizeHref('/docs/pit-zg')}
                class="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline dark:text-blue-300"
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
    class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800"
  >
    <div class="space-y-4">
      <div>
        <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {m.settings_logging_title()}
        </h3>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
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
          class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          {#each LOG_LEVELS as lvl (lvl)}
            <option value={lvl}>{lvl}</option>
          {/each}
        </select>
      </label>
    </div>
  </section>
</div>
