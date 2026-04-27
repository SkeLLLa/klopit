<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Heart } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { formatPlnValue } from '$lib/utils/format-pln.js';
  import { updateSession } from '$lib/services/session.js';
  import { taxSupportFunds } from '$lib/constants/support-funds.js';
  import { debounce } from '$lib/utils/debounce.js';

  let {
    sessionId,
    taxDueBase,
    krs = '',
    details = '',
    consent = false,
  }: {
    sessionId: string;
    taxDueBase: number;
    krs?: string;
    details?: string;
    consent?: boolean;
  } = $props();

  let krsValue = $state('');
  let detailsValue = $state('');
  let consentValue = $state(false);

  // Track whether user picked a known fund or is entering custom KRS
  const CUSTOM = '__custom__';
  let selectedFundId = $state('');

  // Sync incoming props when session changes
  $effect(() => {
    krsValue = krs;
    detailsValue = details;
    consentValue = consent;

    // Match incoming KRS to a known fund
    const match = taxSupportFunds.find((f) => f.krs === krs);
    selectedFundId = match ? match.id : krs ? CUSTOM : '';
  });

  const isCustom = $derived(
    selectedFundId === CUSTOM || selectedFundId === '',
  );

  // Twój e-PIT PIT-38 bases this value on poz. 35, rounded down to full 10 groszy.
  const oppAmount = $derived(Math.floor(taxDueBase * 0.015 * 10) / 10);

  const oppAmountRaw = $derived(oppAmount.toFixed(2));
  const consentRaw = $derived(consentValue ? 'X' : '');
  let copiedField = $state<string | undefined>();
  let copiedResetTimeout: ReturnType<typeof setTimeout> | undefined;

  function editableInputClass(extra = ''): string {
    return `rounded border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 ${extra}`;
  }

  function valueButtonClass(field: string, extra = ''): string {
    return `rounded border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-sm tabular-nums text-slate-900 transition hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-700 ${copiedField === field ? 'ring-2 ring-emerald-400/60 dark:ring-emerald-500/50' : ''} ${extra}`;
  }

  async function copyValue(value: string, field: string) {
    if (!globalThis.navigator?.clipboard) return;

    try {
      await navigator.clipboard.writeText(value);
      copiedField = field;

      if (copiedResetTimeout) clearTimeout(copiedResetTimeout);
      copiedResetTimeout = setTimeout(() => {
        copiedField = undefined;
      }, 1200);
    } catch {
      return;
    }
  }

  async function persistOpp() {
    await updateSession({
      id: sessionId,
      changes: {
        oppKrs: krsValue || undefined,
        oppDetails: detailsValue || undefined,
        oppConsent: consentValue || undefined,
      },
    });
  }

  const persistOppDebounced = debounce(persistOpp, 400);

  onDestroy(() => {
    persistOppDebounced.flush();
    if (copiedResetTimeout) clearTimeout(copiedResetTimeout);
  });

  function handleFundChange() {
    if (selectedFundId === '' || selectedFundId === CUSTOM) {
      krsValue = '';
      detailsValue = '';
      void persistOpp();
      return;
    }
    const fund = taxSupportFunds.find((f) => f.id === selectedFundId);
    if (fund) {
      krsValue = fund.krs;
      detailsValue = fund.paymentDescription;
      void persistOpp();
    }
  }

  function handleKrsInput() {
    persistOppDebounced();
  }

  function handleConsentChange() {
    void persistOpp();
  }
</script>

<div
  class="rounded-lg border border-pink-200 bg-pink-50/50 p-4 dark:border-pink-900 dark:bg-pink-950/30"
>
  <div class="mb-3 flex items-center gap-2">
    <Heart size={18} class="text-pink-500" />
    <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">
      {m.tax_opp_title()}
    </h3>
  </div>

  <div class="grid gap-3 sm:grid-cols-2">
    <!-- Fund selector dropdown -->
    <div class="flex flex-col gap-1 sm:col-span-2">
      <label
        for="opp-fund"
        class="text-xs font-medium text-slate-600 dark:text-slate-400"
      >
        {m.tax_opp_fund_label()}
      </label>
      <select
        id="opp-fund"
        bind:value={selectedFundId}
        onchange={handleFundChange}
        class="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
      >
        <option value="">{m.tax_opp_fund_placeholder()}</option>
        {#each taxSupportFunds as fund (fund.id)}
          <option value={fund.id}>{fund.name} (KRS {fund.krs})</option>
        {/each}
        <option value={CUSTOM}>{m.tax_opp_fund_custom()}</option>
      </select>
    </div>

    <!-- KRS field — shown only in custom mode -->
    {#if isCustom}
      <div class="flex flex-col gap-1">
        <label
          for="opp-krs"
          class="text-xs font-medium text-slate-600 dark:text-slate-400"
        >
          {m.tax_opp_krs_label()}
          <span class="text-slate-400">(poz. 66)</span>
        </label>
        <input
          id="opp-krs"
          type="text"
          bind:value={krsValue}
          oninput={handleKrsInput}
          placeholder={m.tax_opp_krs_placeholder()}
          maxlength={10}
          class={editableInputClass('font-mono tabular-nums')}
        />
      </div>
    {:else}
      <div class="flex flex-col gap-1">
        <label
          for="opp-krs-readonly"
          class="text-xs font-medium text-slate-600 dark:text-slate-400"
        >
          {m.tax_opp_krs_label()}
          <span class="text-slate-400">(poz. 66)</span>
        </label>
        <button
          id="opp-krs-readonly"
          type="button"
          class={valueButtonClass('krs', 'text-left')}
          title={copiedField === 'krs' ? m.tax_copy_value_done() : m.tax_copy_value_title()}
          aria-label={copiedField === 'krs' ? m.tax_copy_value_done() : m.tax_copy_value_title()}
          onclick={() => void copyValue(krsValue, 'krs')}
        >
          {krsValue}
        </button>
      </div>
    {/if}

    <div class="flex flex-col gap-1">
      <label
        for="opp-details"
        class="text-xs font-medium text-slate-600 dark:text-slate-400"
      >
        {m.tax_opp_details_label()}
        <span class="text-slate-400">(poz. 68)</span>
      </label>
      <button
        id="opp-details"
        type="button"
        class={valueButtonClass('details', 'text-left')}
        title={copiedField === 'details' ? m.tax_copy_value_done() : m.tax_copy_value_title()}
        aria-label={copiedField === 'details' ? m.tax_copy_value_done() : m.tax_copy_value_title()}
        onclick={() => void copyValue(detailsValue, 'details')}
      >
        {detailsValue || '-'}
      </button>
    </div>
  </div>

  <div class="mt-3 grid gap-3 sm:grid-cols-4">
    <div class="flex flex-col gap-1">
      <label
        for="opp-amount"
        class="text-xs font-medium text-slate-600 dark:text-slate-400"
      >
        {m.tax_opp_amount()}
        <span class="text-slate-400">(poz. 67)</span>
      </label>
      <button
        id="opp-amount"
        type="button"
        class={valueButtonClass('amount', 'text-right font-semibold text-pink-700 dark:text-pink-300')}
        title={copiedField === 'amount' ? m.tax_copy_value_done() : m.tax_copy_value_title()}
        aria-label={copiedField === 'amount' ? m.tax_copy_value_done() : m.tax_copy_value_title()}
        onclick={() => void copyValue(oppAmountRaw, 'amount')}
      >
        {formatPlnValue(oppAmount)} zl
      </button>
    </div>

    <div class="flex flex-col gap-1 sm:col-span-3">
      <span class="text-xs font-medium text-slate-600 dark:text-slate-400">
        {m.tax_opp_consent_label()}
        <span class="text-slate-400">(poz. 69)</span>
      </span>
      <label
        class="flex min-h-[34px] items-center gap-2 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
      >
        <input
          type="checkbox"
          bind:checked={consentValue}
          onchange={handleConsentChange}
          class="rounded border-slate-300 dark:border-slate-600"
        />
        <span class="min-w-0 flex-1">{m.tax_opp_consent()}</span>
        <button
          type="button"
          class="shrink-0 rounded border border-slate-200 px-2 py-0.5 font-mono text-xs text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-700"
          title={copiedField === 'consent' ? m.tax_copy_value_done() : m.tax_copy_value_title()}
          aria-label={copiedField === 'consent' ? m.tax_copy_value_done() : m.tax_copy_value_title()}
          onclick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void copyValue(consentRaw, 'consent');
          }}
        >
          {consentRaw || '-'}
        </button>
      </label>
    </div>
  </div>
</div>
