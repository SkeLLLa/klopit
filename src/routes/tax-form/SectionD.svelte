<script lang="ts">
  import { AlertTriangle } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import type { Pit38Fields } from '../../core/types.js';
  import type { ApplyLossCarryForwardResult } from '../../core/tax/loss-carry-forward.js';
  import { formatPlnValue } from '$lib/utils/format-pln.js';
  import SectionHeader from './SectionHeader.svelte';
  import FormField from './FormField.svelte';

  let {
    pit38,
    lossDeduction,
  }: {
    pit38: Pit38Fields;
    lossDeduction?: ApplyLossCarryForwardResult;
  } = $props();

  const perYear = $derived(lossDeduction?.perYear ?? []);
  const expiredWarnings = $derived(
    (lossDeduction?.warnings ?? []).filter((w) => w.code === 'expired'),
  );
</script>

<div class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
  <SectionHeader
    title={m.tax_section_d()}
    seeTransactionsHref="/dashboard#trades"
    seeTransactionsLabel={m.taxform_see_trades()}
  />
  <div class="space-y-0.5">
    <FormField label={m.tax_d_prior_loss()} poz={30} value={pit38[30]} />

    {#if perYear.length > 0}
      <div class="py-2">
        <p class="mb-1.5 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {m.tax_d_loss_breakdown_title()}
        </p>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th class="px-2 py-1 font-medium">{m.tax_d_loss_breakdown_year()}</th>
                <th class="px-2 py-1 text-right font-medium">{m.tax_d_loss_breakdown_cap()}</th>
                <th class="px-2 py-1 text-right font-medium">{m.tax_d_loss_breakdown_deducted()}</th>
                <th class="px-2 py-1 text-right font-medium">{m.tax_d_loss_breakdown_residual()}</th>
              </tr>
            </thead>
            <tbody>
              {#each perYear as entry (entry.year)}
                <tr class="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
                  <td class="px-2 py-1 font-medium text-slate-900 dark:text-slate-100">{entry.year}</td>
                  <td class="px-2 py-1 text-right tabular-nums text-slate-600 dark:text-slate-400">
                    {formatPlnValue(entry.capPln)}
                  </td>
                  <td class="px-2 py-1 text-right tabular-nums text-slate-900 dark:text-slate-100">
                    {formatPlnValue(entry.deductedPln)}
                  </td>
                  <td class="px-2 py-1 text-right tabular-nums text-slate-600 dark:text-slate-400">
                    {formatPlnValue(
                      Math.max(
                        entry.totalLossPln - entry.previouslyDeductedPln - entry.deductedPln,
                        0,
                      ),
                    )}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

    {#each expiredWarnings as w (w.year)}
      <div
        class="my-1 flex items-start gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200"
      >
        <AlertTriangle size={14} class="mt-0.5 shrink-0" />
        <span>
          {m.tax_d_loss_warning_expired({
            year: w.year,
            amount: formatPlnValue(w.amountPln),
          })}
        </span>
      </div>
    {/each}

    <FormField label={m.tax_d_tax_base()} poz={31} value={pit38[31]} />
    <FormField label={m.tax_d_tax_rate()} poz={32} value={19} suffix="%" />
    <FormField label={m.tax_d_tax_amount()} poz={33} value={pit38[33]} />
    <FormField label={m.tax_d_foreign_tax()} poz={34} value={pit38[34]} />
    <FormField label={m.tax_d_tax_due()} poz={35} value={pit38[35]} highlighted={true} />
  </div>
</div>
