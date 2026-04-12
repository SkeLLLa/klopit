<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { db } from '$lib/db.js';
  import { useLiveQuery } from '$lib/utils/live-query.svelte.js';
  import { isinToCountry } from '../../core/tax/country.js';

  let { sessionId }: { sessionId: string } = $props();

  // Load all symbols with ISINs from trades and dividends
  const tradesQuery = useLiveQuery(() =>
    db.trades.where('sessionId').equals(sessionId).toArray(),
  );
  const dividendsQuery = useLiveQuery(() =>
    db.dividends.where('sessionId').equals(sessionId).toArray(),
  );
  const overridesQuery = useLiveQuery(() =>
    db.symbolCountryOverrides.where('sessionId').equals(sessionId).toArray(),
  );

  interface SymbolEntry {
    symbol: string;
    isin: string | undefined;
    detected: string;
    override: string;
  }

  const entries = $derived.by(() => {
    const trades = tradesQuery.current ?? [];
    const dividends = dividendsQuery.current ?? [];
    const overrides = overridesQuery.current ?? [];

    const overrideMap = new Map(overrides.map((o) => [o.symbol, o.country]));
    const symbolMap = new Map<string, { isin?: string }>();

    for (const t of trades) {
      if (!symbolMap.has(t.symbol)) {
        symbolMap.set(t.symbol, { isin: t.isin });
      } else if (t.isin && !symbolMap.get(t.symbol)!.isin) {
        symbolMap.get(t.symbol)!.isin = t.isin;
      }
    }
    for (const d of dividends) {
      if (!symbolMap.has(d.symbol)) {
        symbolMap.set(d.symbol, { isin: d.isin });
      } else if (d.isin && !symbolMap.get(d.symbol)!.isin) {
        symbolMap.get(d.symbol)!.isin = d.isin;
      }
    }

    const result: SymbolEntry[] = [];
    for (const [symbol, info] of symbolMap) {
      result.push({
        symbol,
        isin: info.isin,
        detected: isinToCountry({ isin: info.isin }),
        override: overrideMap.get(symbol) ?? '',
      });
    }

    return result.sort((a, b) => a.symbol.localeCompare(b.symbol));
  });

  async function handleOverrideChange(symbol: string, value: string) {
    const trimmed = value.trim().toUpperCase();

    // Delete existing override for this symbol
    await db.symbolCountryOverrides.where({ sessionId, symbol }).delete();

    // Add new override if non-empty
    if (trimmed.length > 0) {
      await db.symbolCountryOverrides.add({
        sessionId,
        symbol,
        country: trimmed,
      });
    }
  }
</script>

{#if entries.length > 0}
  <div
    class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
  >
    <h3 class="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
      {m.data_country_mapping_title()}
    </h3>
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr
            class="border-b border-slate-200 text-xs font-medium uppercase text-slate-500 dark:border-slate-600 dark:text-slate-400"
          >
            <th class="px-3 py-2">{m.data_symbol()}</th>
            <th class="px-3 py-2">{m.data_isin()}</th>
            <th class="px-3 py-2">{m.data_country_detected()}</th>
            <th class="px-3 py-2">{m.data_country_override()}</th>
          </tr>
        </thead>
        <tbody>
          {#each entries as entry}
            <tr class="border-b border-slate-100 dark:border-slate-700">
              <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100"
                >{entry.symbol}</td
              >
              <td class="px-3 py-2 font-mono text-xs text-slate-500 dark:text-slate-400"
                >{entry.isin ?? '—'}</td
              >
              <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{entry.detected}</td>
              <td class="px-3 py-2">
                <input
                  type="text"
                  maxlength="2"
                  class="w-16 rounded border border-slate-300 px-2 py-1 text-xs uppercase dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  placeholder={m.data_country_override_placeholder()}
                  value={entry.override}
                  onchange={(e) => void handleOverrideChange(entry.symbol, e.currentTarget.value)}
                />
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}
