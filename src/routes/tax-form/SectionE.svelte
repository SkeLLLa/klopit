<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { Pit38Fields } from '../../core/types.js';
  import SectionHeader from './SectionHeader.svelte';
  import FormField from './FormField.svelte';

  let { pit38 }: { pit38: Pit38Fields } = $props();
</script>

<div class="rounded-lg border border-slate-200 bg-white p-4 opacity-60 dark:border-slate-700 dark:bg-slate-800">
  <SectionHeader title={m.tax_section_e()} placeholder={true} />
  <p class="mb-2 text-xs italic text-slate-400 dark:text-slate-500">{m.tax_not_supported()}</p>
  <div class="space-y-0.5">
    <FormField label={m.tax_e_crypto_proceeds()} poz={36} value={pit38[36]} variant="placeholder" />
    <FormField label={m.tax_e_crypto_costs_current()} poz={37} value={pit38[37]} variant="placeholder" />
    <FormField label={m.tax_e_crypto_costs_prior()} poz={38} value={pit38[38]} variant="placeholder" />
    <FormField label={m.tax_e_crypto_gain()} poz={39} value={pit38[39]} variant="placeholder" />
    <FormField label={m.tax_e_crypto_undeducted()} poz={40} value={pit38[40]} variant="placeholder" />
  </div>
</div>
