<script lang="ts">
  import type { IndexableTypeArray } from 'dexie';
  import { m } from '$lib/paraglide/messages.js';
  import { db } from '$lib/db.js';
  import { useLiveQuery } from '$lib/utils/live-query.svelte.js';
  import MissingIsinLookup from '$lib/components/ui/MissingIsinLookup.svelte';
  import { isinToCountry } from '../../core/tax/country.js';
  import { buildSymbolCountryMap } from '../../core/tax/symbol-country.js';
  import { getDividendCreditCapRate } from '../../core/tax/treaty-rates.js';

  let { sessionId }: { sessionId: string } = $props();

  // ---------------------------------------------------------------------------
  // Indexed uniqueKeys() queries — avoids full table scans on large sessions.
  //
  // Two queries per table are required because `isin` is optional on Trade and
  // RawDividend. Records where isin is undefined are excluded from the
  // [sessionId+symbol+isin] compound index, so we also enumerate all distinct
  // symbols via [sessionId+symbol] to ensure ISIN-less symbols are still shown.
  // ---------------------------------------------------------------------------

  interface SymbolIsin {
    symbol: string;
    isin: string | undefined;
  }

  /** Extract (symbol, isin?) pairs from uniqueKeys() results for [sessionId+symbol+isin]. */
  function keysToSymbolIsin(keys: readonly unknown[]): SymbolIsin[] {
    const out: SymbolIsin[] = [];
    for (const k of keys) {
      if (!Array.isArray(k)) continue;
      const tuple = k as [unknown, unknown, unknown];
      const symbol = tuple[1];
      const isin = tuple[2];
      if (typeof symbol !== 'string') continue;
      out.push({ symbol, isin: typeof isin === 'string' ? isin : undefined });
    }
    return out;
  }

  /** Extract distinct symbols from uniqueKeys() results for [sessionId+symbol]. */
  function keysToSymbols(keys: readonly unknown[]): string[] {
    const out: string[] = [];
    for (const k of keys) {
      if (!Array.isArray(k)) continue;
      const tuple = k as [unknown, unknown];
      const symbol = tuple[1];
      if (typeof symbol === 'string') out.push(symbol);
    }
    return out;
  }

  // Distinct (symbol, isin) pairs — covers records that have an ISIN.
  const tradeSymbolIsinQuery = useLiveQuery(() => {
    if (!sessionId) return [] as IndexableTypeArray;
    return db.trades
      .where('[sessionId+symbol+isin]')
      .between([sessionId, '\u0000', '\u0000'], [sessionId, '\uffff', '\uffff'])
      .uniqueKeys();
  });
  const dividendSymbolIsinQuery = useLiveQuery(() => {
    if (!sessionId) return [] as IndexableTypeArray;
    return db.dividends
      .where('[sessionId+symbol+isin]')
      .between([sessionId, '\u0000', '\u0000'], [sessionId, '\uffff', '\uffff'])
      .uniqueKeys();
  });

  // Distinct symbols — covers ALL records including those without an ISIN.
  const tradeSymbolsQuery = useLiveQuery(() => {
    if (!sessionId) return [] as IndexableTypeArray;
    return db.trades
      .where('[sessionId+symbol]')
      .between([sessionId, '\u0000'], [sessionId, '\uffff'])
      .uniqueKeys();
  });
  const dividendSymbolsQuery = useLiveQuery(() => {
    if (!sessionId) return [] as IndexableTypeArray;
    return db.dividends
      .where('[sessionId+symbol]')
      .between([sessionId, '\u0000'], [sessionId, '\uffff'])
      .uniqueKeys();
  });

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
    const tradeSymbolIsins = keysToSymbolIsin(tradeSymbolIsinQuery.current ?? []);
    const dividendSymbolIsins = keysToSymbolIsin(dividendSymbolIsinQuery.current ?? []);
    const tradeSymbols = keysToSymbols(tradeSymbolsQuery.current ?? []);
    const dividendSymbols = keysToSymbols(dividendSymbolsQuery.current ?? []);
    const overrides = overridesQuery.current ?? [];

    const overrideMap = new Map(overrides.map((o) => [o.symbol, o.country]));
    const detectedMap = buildSymbolCountryMap({
      trades: tradeSymbolIsins,
      dividends: dividendSymbolIsins,
    });
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local variable inside $derived.by, not reactive state
    const symbolMap = new Map<string, { isin?: string }>();

    // Seed all distinct symbols first (ensures ISIN-less symbols appear).
    for (const symbol of tradeSymbols) {
      if (!symbolMap.has(symbol)) symbolMap.set(symbol, {});
    }
    for (const symbol of dividendSymbols) {
      if (!symbolMap.has(symbol)) symbolMap.set(symbol, {});
    }

    // Fill in ISINs from the compound-index results.
    function shouldUseIsin(existing: { isin?: string } | undefined, isin?: string) {
      if (!isin) return false;
      if (!existing?.isin) return true;
      return (
        isinToCountry({ isin: existing.isin }) === 'XX' &&
        isinToCountry({ isin }) !== 'XX'
      );
    }

    for (const { symbol, isin } of tradeSymbolIsins) {
      const existing = symbolMap.get(symbol);
      if (!existing) {
        symbolMap.set(symbol, { isin });
      } else if (shouldUseIsin(existing, isin)) {
        existing.isin = isin;
      }
    }
    for (const { symbol, isin } of dividendSymbolIsins) {
      const existing = symbolMap.get(symbol);
      if (!existing) {
        symbolMap.set(symbol, { isin });
      } else if (shouldUseIsin(existing, isin)) {
        existing.isin = isin;
      }
    }

    const result: SymbolEntry[] = [];
    for (const [symbol, info] of symbolMap) {
      result.push({
        symbol,
        isin: info.isin,
        detected: detectedMap.get(symbol) ?? isinToCountry({ isin: info.isin }),
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
            <th class="px-3 py-2 text-right">{m.data_dtt_rate()}</th>
          </tr>
        </thead>
        <tbody>
          {#each entries as entry (entry.symbol)}
            {@const effectiveCountry = entry.override || entry.detected}
            {@const dttRate = getDividendCreditCapRate({ country: effectiveCountry })}
            <tr class="border-b border-slate-100 dark:border-slate-700">
              <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100"
                >{entry.symbol}</td
              >
              <td class="px-3 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                {#if entry.isin}
                  {entry.isin}
                {:else}
                  <div class="flex items-center gap-1">
                    <span>—</span>
                    <MissingIsinLookup symbol={entry.symbol} />
                  </div>
                {/if}
              </td>
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
              <td
                class="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300"
                >{(dttRate * 100).toFixed(0)}%</td
              >
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}
