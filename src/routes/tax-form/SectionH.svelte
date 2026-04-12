<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { Pit38Fields } from '../../core/types.js';
  import SectionHeader from './SectionHeader.svelte';
  import FormField from './FormField.svelte';

  let { pit38 }: { pit38: Pit38Fields } = $props();

  const months = $derived([
    { label: m.tax_h_month_1(), poz: 53, value: pit38[53] },
    { label: m.tax_h_month_2(), poz: 54, value: pit38[54] },
    { label: m.tax_h_month_3(), poz: 55, value: pit38[55] },
    { label: m.tax_h_month_4(), poz: 56, value: pit38[56] },
    { label: m.tax_h_month_5(), poz: 57, value: pit38[57] },
    { label: m.tax_h_month_6(), poz: 58, value: pit38[58] },
    { label: m.tax_h_month_7(), poz: 59, value: pit38[59] },
    { label: m.tax_h_month_8(), poz: 60, value: pit38[60] },
    { label: m.tax_h_month_9(), poz: 61, value: pit38[61] },
    { label: m.tax_h_month_10(), poz: 62, value: pit38[62] },
    { label: m.tax_h_month_11(), poz: 63, value: pit38[63] },
    { label: m.tax_h_month_12(), poz: 64, value: pit38[64] },
  ] as const);
</script>

<div class="rounded-lg border border-slate-200 bg-white p-4 opacity-60 dark:border-slate-700 dark:bg-slate-800">
  <SectionHeader title={m.tax_section_h()} placeholder={true} />
  <p class="mb-2 text-xs italic text-slate-400 dark:text-slate-500">{m.tax_not_supported()}</p>
  <div class="grid grid-cols-2 gap-x-6 gap-y-0.5">
    {#each months as month (month.poz)}
      <FormField label={month.label} poz={month.poz} value={month.value} variant="placeholder" />
    {/each}
  </div>
</div>
