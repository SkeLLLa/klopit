<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { Pit38Fields } from '../../core/types.js';
  import SectionHeader from './SectionHeader.svelte';
  import FormField from './FormField.svelte';

  let { pit38 }: { pit38: Pit38Fields } = $props();
</script>

<div class="rounded-lg border border-slate-200 bg-white p-4 opacity-60 dark:border-slate-700 dark:bg-slate-800">
  <SectionHeader title={m.tax_section_f()} placeholder={true} />
  <p class="mb-2 text-xs italic text-slate-400 dark:text-slate-500">{m.tax_not_supported()}</p>
  <div class="space-y-0.5">
    <FormField label={m.tax_f_tax_base()} poz={41} value={pit38[41]} variant="placeholder" />
    <FormField label={m.tax_f_tax_rate()} poz={42} value={19} suffix="%" variant="placeholder" />
    <FormField label={m.tax_f_tax_amount()} poz={43} value={pit38[43]} variant="placeholder" />
    <FormField label={m.tax_f_foreign_tax()} poz={44} value={pit38[44]} variant="placeholder" />
    <FormField label={m.tax_f_tax_due()} poz={45} value={pit38[45]} variant="placeholder" />
  </div>
</div>
