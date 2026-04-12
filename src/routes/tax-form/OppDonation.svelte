<script lang="ts">
  import { Heart } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { formatPlnValue } from '$lib/utils/format-pln.js';
  import { updateSession } from '$lib/services/session.js';
  import { taxSupportFunds } from '$lib/constants/support-funds.js';

  let {
    sessionId,
    taxToPay,
    krs = '',
    details = '',
    consent = false,
  }: {
    sessionId: string;
    taxToPay: number;
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

  // 1.5% rounded down to full 10 groszy
  const oppAmount = $derived(Math.floor(taxToPay * 0.015 * 10) / 10);

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

  function handleFundChange() {
    if (selectedFundId === '' || selectedFundId === CUSTOM) {
      // Switching to custom — clear fields so user can type
      if (selectedFundId === '') {
        krsValue = '';
        detailsValue = '';
      }
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
    void persistOpp();
  }

  function handleDetailsInput() {
    void persistOpp();
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
          class="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        />
      </div>
    {:else}
      <div class="flex flex-col gap-1">
        <span
          class="text-xs font-medium text-slate-600 dark:text-slate-400"
        >
          {m.tax_opp_krs_label()}
          <span class="text-slate-400">(poz. 66)</span>
        </span>
        <span
          class="rounded border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300"
        >
          {krsValue}
        </span>
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
      <input
        id="opp-details"
        type="text"
        bind:value={detailsValue}
        oninput={handleDetailsInput}
        placeholder={m.tax_opp_details_placeholder()}
        class="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
      />
    </div>
  </div>

  <div class="mt-3 flex items-center justify-between gap-4">
    <label
      class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
    >
      <input
        type="checkbox"
        bind:checked={consentValue}
        onchange={handleConsentChange}
        class="rounded border-slate-300 dark:border-slate-600"
      />
      <span>
        {m.tax_opp_consent()} <span class="text-slate-400">(poz. 69)</span>
      </span>
    </label>

    <div class="text-right">
      <span class="text-xs text-slate-500 dark:text-slate-400">
        {m.tax_opp_amount()} (poz. 67)
      </span>
      <div
        class="font-mono text-sm font-semibold text-pink-700 dark:text-pink-300"
      >
        {formatPlnValue(oppAmount)} zl
      </div>
    </div>
  </div>
</div>
