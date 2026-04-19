<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { Pit38Fields } from '../../core/types.js';
  import SectionHeader from './SectionHeader.svelte';
  import FormField from './FormField.svelte';

  let { pit38 }: { pit38: Pit38Fields } = $props();
</script>

<div class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
  <SectionHeader
    title={m.tax_section_g()}
    seeTransactionsHref="/dashboard#dividends"
    seeTransactionsLabel={m.taxform_see_dividends()}
  />
  <div class="space-y-0.5">
    <FormField label={m.tax_g_flat_rate_tax()} poz={46} value={pit38[46]} />
    <FormField label={m.tax_g_dividend_tax()} poz={47} value={pit38[47]} />
    <FormField label={m.tax_g_foreign_withholding()} poz={48} value={pit38[48]} />
    <FormField label={m.tax_g_difference()} poz={49} value={pit38[49]} />
    <FormField label={m.tax_g_advance_payments()} poz={50} value={pit38[50]} />
    <div class="my-2 border-t border-slate-200 dark:border-slate-600"></div>
    <FormField label={m.tax_g_tax_to_pay()} poz={51} value={pit38[51]} highlighted={pit38[51] > 0} />
    <FormField label={m.tax_g_overpayment()} poz={52} value={pit38[52]} highlighted={pit38[52] > 0} />
  </div>
</div>
