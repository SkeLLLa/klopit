<script lang="ts">
  import { Info } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { localizeHref } from '$lib/paraglide/runtime';
  import type { PitZgFields } from '../../core/types.js';
  import SectionHeader from './SectionHeader.svelte';
  import FormField from './FormField.svelte';

  let { pitZg }: { pitZg: PitZgFields } = $props();

  const hasCapitalGains = $derived(pitZg.proceedsPln !== undefined);
  const hasDividends = $derived(pitZg.dividendIncomePln !== undefined);
  const titleCountry = $derived(`${pitZg.country} - ${pitZg.countryNamePl}`);
</script>

<div class="space-y-4">
  <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
    {m.tax_pitzg_title({ country: titleCountry })}
  </h2>

  <div class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
    <div class="space-y-0.5">
      <FormField
        label={m.tax_pitzg_country_name()}
        poz={6}
        value={pitZg.countryNamePl}
      />
      <FormField
        label={m.tax_pitzg_country_code()}
        poz={7}
        value={pitZg.country}
      />
    </div>
  </div>

  {#if hasCapitalGains}
  <div
    class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
  >
    <div class="mb-3 flex items-center justify-between gap-3 border-b border-slate-200 pb-2 dark:border-slate-700">
      <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">
        {m.tax_pitzg_section_c()}
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
      <FormField
        label={m.tax_pitzg_income_item_29()}
        poz={29}
        value={pitZg.gainPln ?? 0}
      />
      <FormField
        label={m.tax_pitzg_tax_item_30()}
        poz={30}
        value={pitZg.tradeForeignTaxPln ?? 0}
        help={m.tax_pitzg_tax_item_30_help()}
      />
    </div>
  </div>
  {/if}

  {#if hasDividends}
    <div class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <SectionHeader title={m.tax_pitzg_dividend_title()} />
      <div class="space-y-0.5">
        <FormField label={m.tax_pitzg_dividend_income()} value={pitZg.dividendIncomePln ?? 0} />
        <FormField label={m.tax_pitzg_foreign_tax()} value={pitZg.dividendForeignTaxPln ?? 0} />
        <FormField label={m.tax_pitzg_deductible_tax()} value={pitZg.deductibleDividendTaxPln ?? 0} />
      </div>
    </div>
  {/if}
</div>
