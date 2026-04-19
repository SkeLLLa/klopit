<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { Snippet } from 'svelte';

  type TabId =
    | 'trades'
    | 'dividends'
    | 'interest'
    | 'withholding'
    | 'corporateActions'
    | 'carryIn'
    | 'skipped';

  let {
    activeTab = $bindable('trades'),
    counts,
    children,
  }: {
    activeTab?: TabId;
    counts: Record<TabId, number>;
    children: Snippet<[TabId]>;
  } = $props();

  const tabs: { id: TabId; label: () => string }[] = [
    { id: 'trades', label: () => m.data_tab_trades() },
    { id: 'dividends', label: () => m.data_tab_dividends() },
    { id: 'interest', label: () => m.data_tab_credit_interest() },
    { id: 'withholding', label: () => m.data_tab_withholding() },
    { id: 'corporateActions', label: () => m.data_tab_corporate_actions() },
    { id: 'carryIn', label: () => m.data_tab_carry_in() },
    { id: 'skipped', label: () => m.data_tab_skipped() },
  ];
</script>

<div>
  <div class="border-b border-slate-200 dark:border-slate-700">
    <nav class="-mb-px flex gap-1 overflow-x-auto" aria-label="Data tabs">
      {#each tabs as tab (tab.id)}
        <button
          onclick={() => (activeTab = tab.id)}
          class="whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors {activeTab ===
          tab.id
            ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
            : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}"
        >
          {tab.label()}
          {#if counts[tab.id] > 0}
            <span
              class="ml-1.5 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300"
            >
              {counts[tab.id]}
            </span>
          {/if}
        </button>
      {/each}
    </nav>
  </div>

  <div class="pt-4">
    {@render children(activeTab)}
  </div>
</div>
