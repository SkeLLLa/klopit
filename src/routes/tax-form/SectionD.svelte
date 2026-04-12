<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { Pit38Fields } from '../../core/types.js';
  import SectionHeader from './SectionHeader.svelte';
  import FormField from './FormField.svelte';

  let { pit38 }: { pit38: Pit38Fields } = $props();
</script>

<div class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
  <SectionHeader title={m.tax_section_d()} />
  <div class="space-y-0.5">
    <FormField label={m.tax_d_prior_loss()} poz={30} value={pit38[30]} />
    <FormField label={m.tax_d_tax_base()} poz={31} value={pit38[31]} />
    <FormField label={m.tax_d_tax_rate()} poz={32} value={19} suffix="%" />
    <FormField label={m.tax_d_tax_amount()} poz={33} value={pit38[33]} />
    <FormField label={m.tax_d_foreign_tax()} poz={34} value={pit38[34]} />
    <FormField label={m.tax_d_tax_due()} poz={35} value={pit38[35]} highlighted={true} />
  </div>
</div>
