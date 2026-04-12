<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { PitZgFields } from '../../core/types.js';
  import SectionHeader from './SectionHeader.svelte';
  import FormField from './FormField.svelte';

  let { pitZg }: { pitZg: PitZgFields } = $props();
</script>

<div class="space-y-4">
  <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
    {m.tax_pitzg_title({ country: pitZg.country })}
  </h2>

  <!-- Section C — Capital Gains -->
  <div class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
    <SectionHeader title={m.tax_pitzg_section_c()} />
    <div class="space-y-0.5">
      <FormField label={m.tax_pitzg_proceeds()} value={pitZg.proceedsPln} />
      <FormField label={m.tax_pitzg_cost()} value={pitZg.costPln} />
      <FormField label={m.tax_pitzg_gain()} value={pitZg.gainPln} highlighted={pitZg.gainPln > 0} />
      <FormField label={m.tax_pitzg_loss()} value={pitZg.lossPln} highlighted={pitZg.lossPln > 0} />
    </div>
  </div>

  <!-- Section D — Dividends -->
  <div class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
    <SectionHeader title={m.tax_pitzg_section_d()} />
    <div class="space-y-0.5">
      <FormField label={m.tax_pitzg_dividend_income()} value={pitZg.dividendIncomePln} />
      <FormField label={m.tax_pitzg_foreign_tax()} value={pitZg.foreignTaxPaidPln} />
      <FormField label={m.tax_pitzg_deductible_tax()} value={pitZg.deductibleForeignTaxPln} />
    </div>
  </div>
</div>
