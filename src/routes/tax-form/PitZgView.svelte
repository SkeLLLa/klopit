<script lang="ts">
  import { Info } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { localizeHref } from '$lib/paraglide/runtime';
  import type { PitZgFields } from '../../core/types.js';
  import SectionHeader from './SectionHeader.svelte';
  import FormField from './FormField.svelte';

  let { pitZg }: { pitZg: PitZgFields } = $props();
</script>

<div class="space-y-4">
  <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
    {m.tax_pitzg_title({ country: pitZg.country })}
  </h2>

  {#if pitZg.proceedsPln !== undefined}
    <div
      class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
    >
      <div class="mb-3 flex items-center justify-between gap-3 border-b border-slate-200 pb-2 dark:border-slate-700">
        <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {m.tax_pitzg_capital_gains_title()}
        </h3>
        <div class="flex items-center gap-2">
          <span
            class="inline-flex items-center text-slate-400"
            title={m.tax_pitzg_section_c_tooltip()}
          >
            <Info size={14} />
          </span>
          <a
            href={localizeHref('/docs/pit-zg')}
            class="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {m.tax_pitzg_learn_more()}
          </a>
        </div>
      </div>
      <div class="space-y-0.5">
        <FormField label={m.tax_c_total_proceeds()} value={pitZg.proceedsPln} />
        <FormField label={m.tax_c_total_costs()} value={pitZg.costPln ?? 0} />
        <FormField label={m.tax_c_gain()} value={pitZg.gainPln ?? 0} />
        <FormField label={m.tax_c_loss()} value={pitZg.lossPln ?? 0} />
        <FormField
          label={m.tax_pitzg_foreign_tax()}
          value={pitZg.tradeForeignTaxPln ?? 0}
        />
      </div>
    </div>
  {/if}

  <!-- Section D — Dividends -->
  <div class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
    <SectionHeader title={m.tax_pitzg_dividend_title()} />
    <div class="space-y-0.5">
      <FormField label={m.tax_pitzg_dividend_income()} value={pitZg.dividendIncomePln} />
      <FormField label={m.tax_pitzg_foreign_tax()} value={pitZg.dividendForeignTaxPln} />
      <FormField label={m.tax_pitzg_deductible_tax()} value={pitZg.deductibleDividendTaxPln} />
    </div>
  </div>
</div>
