<!-- src/routes/data/IncentiveRegimeBar.svelte -->
<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { setIncentiveRegimeForSymbol } from '$lib/services/incentive.js';
  import { isIncentiveBuy } from '../../core/tax/incentive.js';
  import type { IncentiveRegime, Trade } from '../../core/types.js';

  let { sessionId, trades }: { sessionId: string; trades: Trade[] } = $props();

  const symbols = $derived([
    ...new Set(trades.filter((t) => isIncentiveBuy(t)).map((t) => t.symbol)),
  ]);

  async function handleBulk(symbol: string, value: string) {
    if (value === '') return;
    await setIncentiveRegimeForSymbol({
      sessionId,
      symbol,
      regime: value === 'none' ? undefined : (value as IncentiveRegime),
    });
  }
</script>

<div
  class="mb-3 space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
>
  <details class="text-xs">
    <summary class="cursor-pointer">{m.data_incentive_help_summary()}</summary>
    <div class="mt-2 space-y-1">
      <p>{m.data_incentive_help_qualifying()}</p>
      <p>{m.data_incentive_help_taxed()}</p>
      <p>{m.data_incentive_help_check()}</p>
    </div>
  </details>
  <div class="flex flex-wrap items-center gap-3 text-xs">
    {#each symbols as symbol (symbol)}
      <label class="flex items-center gap-2">
        <span>{m.data_incentive_bulk({ symbol })}</span>
        <select
          value=""
          onchange={(e) => {
            void handleBulk(symbol, e.currentTarget.value);
            e.currentTarget.value = '';
          }}
          class="rounded-md border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
        >
          <option value="">—</option>
          <option value="qualifying">{m.data_incentive_regime_qualifying()}</option>
          <option value="taxed-at-acquisition">{m.data_incentive_regime_taxed()}</option>
          <option value="none">{m.data_incentive_regime_clear()}</option>
        </select>
      </label>
    {/each}
  </div>
</div>
