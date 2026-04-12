<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { Pit38Fields } from '../../core/types.js';
  import SectionHeader from './SectionHeader.svelte';
  import FormField from './FormField.svelte';

  let { pit38 }: { pit38: Pit38Fields } = $props();
</script>

<div class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
  <SectionHeader title={m.tax_section_c()} />
  <div class="space-y-0.5">
    <FormField label={m.tax_c_pit8c_proceeds()} poz={20} value={pit38[20]} />
    <FormField label={m.tax_c_pit8c_costs()} poz={21} value={pit38[21]} />
    <div class="my-2 border-t border-slate-100 dark:border-slate-700"></div>
    <FormField label={m.tax_c_other_proceeds()} poz={22} value={pit38[22]} />
    <div class="my-2 border-t border-slate-100 dark:border-slate-700"></div>
    <FormField label={m.tax_c_exempt_proceeds()} poz={24} value={pit38[24]} />
    <FormField label={m.tax_c_exempt_costs()} poz={25} value={pit38[25]} />
    <div class="my-2 border-t border-slate-100 dark:border-slate-700"></div>
    <FormField label={m.tax_c_total_proceeds()} poz={26} value={pit38[26]} />
    <FormField label={m.tax_c_total_costs()} poz={27} value={pit38[27]} />
    <FormField label={m.tax_c_gain()} poz={28} value={pit38[28]} highlighted={pit38[28] > 0} />
    <FormField label={m.tax_c_loss()} poz={29} value={pit38[29]} highlighted={pit38[29] > 0} />
  </div>
</div>
