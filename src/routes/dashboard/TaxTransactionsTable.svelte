<script lang="ts">
  import { AlertTriangle } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import type { TradeResultRecord, DividendResultRecord } from '$lib/db.js';
  import { formatDatetime, formatDate } from '$lib/utils/format-date.js';
  import { formatPlnValue } from '$lib/utils/format-pln.js';
  import { TAX_RATE } from '../../core/types.js';
  import { getDividendCreditCapRate } from '../../core/tax/treaty-rates.js';

  let {
    tradeResults,
    dividendResults,
  }: {
    tradeResults: TradeResultRecord[];
    dividendResults: DividendResultRecord[];
  } = $props();

  const TAX_PCT = TAX_RATE * 100;

  const sellTrades = $derived(
    tradeResults
      .filter((t) => t.type === 'sell' && t.source !== 'corporate-action')
      .sort(
        (a, b) =>
          new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
      ),
  );

  const corporateActionTrades = $derived(
    tradeResults
      .filter((t) => t.type === 'sell' && t.source === 'corporate-action')
      .sort(
        (a, b) =>
          new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
      ),
  );

  // Capital gains totals
  const tradeTotalProceeds = $derived(
    sellTrades.reduce((s, t) => s + t.proceedsPln, 0),
  );
  const tradeTotalCost = $derived(
    sellTrades.reduce((s, t) => s + t.costPln, 0),
  );
  const tradeTotalGainLoss = $derived(
    sellTrades.reduce((s, t) => s + t.gainLossPln, 0),
  );
  const tradeTotalTax = $derived(Math.max(tradeTotalGainLoss, 0) * TAX_RATE);

  // Corporate action totals
  const caTotalProceeds = $derived(
    corporateActionTrades.reduce((s, t) => s + t.proceedsPln, 0),
  );
  const caTotalCost = $derived(
    corporateActionTrades.reduce((s, t) => s + t.costPln, 0),
  );
  const caTotalGainLoss = $derived(
    corporateActionTrades.reduce((s, t) => s + t.gainLossPln, 0),
  );
  const caTotalTax = $derived(Math.max(caTotalGainLoss, 0) * TAX_RATE);

  // Dividend totals — cap deductible withholding per-dividend (art. 30a ust. 9)
  const divTotalAmount = $derived(
    dividendResults.reduce((s, d) => s + d.amountPln, 0),
  );
  const divTotalTaxPl = $derived(divTotalAmount * TAX_RATE);
  const divTotalWithholding = $derived(
    dividendResults.reduce((s, d) => s + d.withholdingTaxPln, 0),
  );
  const divTotalDeductible = $derived(
    dividendResults.reduce(
      (s, d) =>
        s +
        Math.min(
          d.withholdingTaxPln,
          d.amountPln * getDividendCreditCapRate({ country: d.country }),
        ),
      0,
    ),
  );
  const divTotalWithholdingPct = $derived(
    divTotalAmount > 0 ? (divTotalWithholding / divTotalAmount) * 100 : 0,
  );
  const divTotalToPay = $derived(
    Math.max(divTotalTaxPl - divTotalDeductible, 0),
  );
  const divTotalToPayPct = $derived(
    divTotalAmount > 0 ? (divTotalToPay / divTotalAmount) * 100 : 0,
  );

  function formatPct(value: number): string {
    return `${value.toFixed(1)}%`;
  }
</script>

<div
  class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
>
  <h3 class="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
    {m.dash_tax_transactions()}
  </h3>

  <!-- Capital Gains Trades -->
  {#if sellTrades.length > 0}
    <h4
      class="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400"
    >
      {m.dash_capital_gains()}
    </h4>
    <div class="mb-6 overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr
            class="border-b border-slate-200 text-xs font-medium uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400"
          >
            <th class="px-3 py-2">{m.data_datetime()}</th>
            <th class="px-3 py-2">{m.data_symbol()}</th>
            <th class="px-3 py-2 text-right">{m.data_quantity()}</th>
            <th class="px-3 py-2 text-right">{m.dash_proceeds()} (PLN)</th>
            <th class="px-3 py-2 text-right">{m.dash_cost_basis()} (PLN)</th>
            <th class="px-3 py-2 text-right">{m.dash_tx_gain_loss()} (PLN)</th>
            <th class="px-3 py-2 text-right"
              >{m.dash_tx_tax_pl()} ({formatPct(TAX_PCT)})</th
            >
            <th class="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {#each sellTrades as trade (trade.symbol + trade.datetime)}
            {@const taxOnTrade = Math.max(trade.gainLossPln, 0) * TAX_RATE}
            <tr
              class="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
            >
              <td class="px-3 py-2 text-slate-600 dark:text-slate-300"
                >{formatDatetime(trade.datetime)}</td
              >
              <td
                class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100"
                >{trade.symbol}</td
              >
              <td
                class="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300"
                >{trade.quantity}</td
              >
              <td
                class="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300"
                >{formatPlnValue(trade.proceedsPln)}</td
              >
              <td
                class="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300"
                >{formatPlnValue(trade.costPln)}</td
              >
              <td
                class="px-3 py-2 text-right tabular-nums {trade.gainLossPln >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}"
                >{formatPlnValue(trade.gainLossPln)}</td
              >
              <td
                class="px-3 py-2 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100"
                >{formatPlnValue(taxOnTrade)}</td
              >
              <td class="px-3 py-2">
                {#if trade.rateUnavailable}
                  <AlertTriangle size={14} class="text-amber-500" />
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr
            class="border-t-2 border-slate-300 font-semibold dark:border-slate-600"
          >
            <td
              class="px-3 py-2 text-slate-900 dark:text-slate-100"
              colspan="3">{m.dash_tx_total()}</td
            >
            <td
              class="px-3 py-2 text-right tabular-nums text-slate-900 dark:text-slate-100"
              >{formatPlnValue(tradeTotalProceeds)}</td
            >
            <td
              class="px-3 py-2 text-right tabular-nums text-slate-900 dark:text-slate-100"
              >{formatPlnValue(tradeTotalCost)}</td
            >
            <td
              class="px-3 py-2 text-right tabular-nums {tradeTotalGainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}"
              >{formatPlnValue(tradeTotalGainLoss)}</td
            >
            <td
              class="px-3 py-2 text-right tabular-nums text-slate-900 dark:text-slate-100"
              >{formatPlnValue(tradeTotalTax)}</td
            >
            <td class="px-3 py-2"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  {/if}

  <!-- Corporate Actions -->
  {#if corporateActionTrades.length > 0}
    <h4
      class="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400"
    >
      {m.dash_corporate_actions()}
    </h4>
    <div class="mb-6 overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr
            class="border-b border-slate-200 text-xs font-medium uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400"
          >
            <th class="px-3 py-2">{m.data_datetime()}</th>
            <th class="px-3 py-2">{m.data_symbol()}</th>
            <th class="px-3 py-2 text-right">{m.dash_proceeds()} (PLN)</th>
            <th class="px-3 py-2 text-right">{m.dash_cost_basis()} (PLN)</th>
            <th class="px-3 py-2 text-right">{m.dash_tx_gain_loss()} (PLN)</th>
            <th class="px-3 py-2 text-right"
              >{m.dash_tx_tax_pl()} ({formatPct(TAX_PCT)})</th
            >
            <th class="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {#each corporateActionTrades as trade (trade.symbol + trade.datetime)}
            {@const taxOnTrade = Math.max(trade.gainLossPln, 0) * TAX_RATE}
            <tr
              class="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
            >
              <td class="px-3 py-2 text-slate-600 dark:text-slate-300"
                >{formatDatetime(trade.datetime)}</td
              >
              <td
                class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100"
                >{trade.symbol}</td
              >
              <td
                class="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300"
                >{formatPlnValue(trade.proceedsPln)}</td
              >
              <td
                class="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300"
                >{formatPlnValue(trade.costPln)}</td
              >
              <td
                class="px-3 py-2 text-right tabular-nums {trade.gainLossPln >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}"
                >{formatPlnValue(trade.gainLossPln)}</td
              >
              <td
                class="px-3 py-2 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100"
                >{formatPlnValue(taxOnTrade)}</td
              >
              <td class="px-3 py-2">
                {#if trade.rateUnavailable}
                  <AlertTriangle size={14} class="text-amber-500" />
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr
            class="border-t-2 border-slate-300 font-semibold dark:border-slate-600"
          >
            <td
              class="px-3 py-2 text-slate-900 dark:text-slate-100"
              colspan="2">{m.dash_tx_total()}</td
            >
            <td
              class="px-3 py-2 text-right tabular-nums text-slate-900 dark:text-slate-100"
              >{formatPlnValue(caTotalProceeds)}</td
            >
            <td
              class="px-3 py-2 text-right tabular-nums text-slate-900 dark:text-slate-100"
              >{formatPlnValue(caTotalCost)}</td
            >
            <td
              class="px-3 py-2 text-right tabular-nums {caTotalGainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}"
              >{formatPlnValue(caTotalGainLoss)}</td
            >
            <td
              class="px-3 py-2 text-right tabular-nums text-slate-900 dark:text-slate-100"
              >{formatPlnValue(caTotalTax)}</td
            >
            <td class="px-3 py-2"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  {/if}

  <!-- Dividends -->
  {#if dividendResults.length > 0}
    <h4
      class="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400"
    >
      {m.dash_dividend_income()}
    </h4>
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr
            class="border-b border-slate-200 text-xs font-medium uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400"
          >
            <th class="px-3 py-2">{m.data_date()}</th>
            <th class="px-3 py-2">{m.data_symbol()}</th>
            <th class="px-3 py-2 text-right">{m.dash_tx_amount()} (PLN)</th>
            <th class="px-3 py-2 text-right"
              >{m.dash_tx_tax_pl()} ({formatPct(TAX_PCT)})</th
            >
            <th class="px-3 py-2 text-right">{m.dash_tx_tax_abroad()}</th>
            <th class="px-3 py-2 text-right">{m.dash_tx_tax_to_pay()}</th>
            <th class="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {#each dividendResults as div (div.symbol + div.date)}
            {@const taxPl = div.amountPln * TAX_RATE}
            {@const creditCap = div.amountPln * getDividendCreditCapRate({ country: div.country })}
            {@const deductible = Math.min(div.withholdingTaxPln, creditCap)}
            {@const effectiveWithholdingPct = div.amountPln > 0 ? (div.withholdingTaxPln / div.amountPln) * 100 : 0}
            {@const taxToPay = Math.max(taxPl - deductible, 0)}
            {@const effectiveToPayPct = div.amountPln > 0 ? (taxToPay / div.amountPln) * 100 : 0}
            <tr
              class="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
            >
              <td class="px-3 py-2 text-slate-600 dark:text-slate-300"
                >{formatDate(div.date)}</td
              >
              <td
                class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100"
                >{div.symbol}</td
              >
              <td
                class="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300"
                >{formatPlnValue(div.amountPln)}</td
              >
              <td
                class="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300"
                >{formatPlnValue(taxPl)}</td
              >
              <td
                class="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300"
              >
                {formatPlnValue(div.withholdingTaxPln)}
                <span class="text-xs text-slate-400">
                  ({formatPct(effectiveWithholdingPct)})
                </span>
              </td>
              <td
                class="px-3 py-2 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100"
              >
                {formatPlnValue(taxToPay)}
                <span class="text-xs text-slate-400">
                  ({formatPct(effectiveToPayPct)})
                </span>
              </td>
              <td class="px-3 py-2">
                {#if div.rateUnavailable}
                  <AlertTriangle size={14} class="text-amber-500" />
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr
            class="border-t-2 border-slate-300 font-semibold dark:border-slate-600"
          >
            <td
              class="px-3 py-2 text-slate-900 dark:text-slate-100"
              colspan="2">{m.dash_tx_total()}</td
            >
            <td
              class="px-3 py-2 text-right tabular-nums text-slate-900 dark:text-slate-100"
              >{formatPlnValue(divTotalAmount)}</td
            >
            <td
              class="px-3 py-2 text-right tabular-nums text-slate-900 dark:text-slate-100"
              >{formatPlnValue(divTotalTaxPl)}</td
            >
            <td
              class="px-3 py-2 text-right tabular-nums text-slate-900 dark:text-slate-100"
            >
              {formatPlnValue(divTotalWithholding)}
              <span class="text-xs text-slate-400">
                ({formatPct(divTotalWithholdingPct)})
              </span>
            </td>
            <td
              class="px-3 py-2 text-right tabular-nums text-slate-900 dark:text-slate-100"
            >
              {formatPlnValue(divTotalToPay)}
              <span class="text-xs text-slate-400">
                ({formatPct(divTotalToPayPct)})
              </span>
            </td>
            <td class="px-3 py-2"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  {/if}

  {#if sellTrades.length === 0 && corporateActionTrades.length === 0 && dividendResults.length === 0}
    <p class="text-sm text-slate-500 dark:text-slate-400">
      {m.dash_no_income()}
    </p>
  {/if}
</div>
