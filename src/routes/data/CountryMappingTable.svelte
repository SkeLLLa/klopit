<script lang="ts">
  import type { IndexableTypeArray } from 'dexie';
  import { m } from '#lib/paraglide/messages.js';
  import { db } from '#lib/db.js';
  import { useLiveQuery } from '#lib/utils/live-query.svelte.js';
  import MissingIsinLookup from '#lib/components/ui/MissingIsinLookup.svelte';
  import { isinToCountry } from '../../core/tax/country.js';
  import {
    buildSymbolCountryMaps,
    type OverrideScope,
  } from '../../core/tax/symbol-country.js';
  import { setSymbolCountryOverride } from '#lib/services/country-overrides.js';
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

  // ADR issuer countries stamped at import (non-indexed field, so filter in memory).
  const adrDividendsQuery = useLiveQuery(() => {
    if (!sessionId) return [];
    return db.dividends
      .where('sessionId')
      .equals(sessionId)
      .filter((d) => !!d.adrCountry)
      .toArray();
  });

  // Symbols with payment-in-lieu events: their country is the withholding state.
  const pilSymbolsQuery = useLiveQuery(async () => {
    if (!sessionId) return [] as string[];
    const rows = await db.dividends
      .where('sessionId')
      .equals(sessionId)
      .filter((d) => d.kind === 'payment-in-lieu')
      .toArray();
    return [...new Set(rows.map((d) => d.symbol))];
  });
  const pilSymbols = $derived(new Set(pilSymbolsQuery.current ?? []));

  const overridesQuery = useLiveQuery(() =>
    db.symbolCountryOverrides.where('sessionId').equals(sessionId).toArray(),
  );

  interface SymbolEntry {
    symbol: string;
    isin: string | undefined;
    /** ISIN-prefix country: capital gains and PIT/ZG. */
    detected: string;
    /** Country used for dividends (differs from `detected` for ADRs). */
    detectedDividends: string;
    override: string;
    overrideScope: OverrideScope;
  }

  function shouldUseIsin(existing: { isin?: string | undefined } | undefined, isin?: string) {
    if (!isin) return false;
    if (!existing?.isin) return true;
    return (
      isinToCountry({ isin: existing.isin }) === 'XX' &&
      isinToCountry({ isin }) !== 'XX'
    );
  }

  const entries = $derived.by(() => {
    const tradeSymbolIsins = keysToSymbolIsin(tradeSymbolIsinQuery.current ?? []);
    const dividendSymbolIsins = keysToSymbolIsin(dividendSymbolIsinQuery.current ?? []);
    const tradeSymbols = keysToSymbols(tradeSymbolsQuery.current ?? []);
    const dividendSymbols = keysToSymbols(dividendSymbolsQuery.current ?? []);
    const overrides = overridesQuery.current ?? [];

    const overrideMap = new Map(overrides.map((o) => [o.symbol, o]));
    const detectedMaps = buildSymbolCountryMaps({
      trades: tradeSymbolIsins,
      dividends: [
        ...dividendSymbolIsins,
        ...(adrDividendsQuery.current ?? []).map((d) => ({
          symbol: d.symbol,
          adrCountry: d.adrCountry,
        })),
      ],
    });
    const symbolMap = new Map<string, { isin?: string | undefined }>();

    // Seed all distinct symbols first (ensures ISIN-less symbols appear).
    for (const symbol of tradeSymbols) {
      if (!symbolMap.has(symbol)) symbolMap.set(symbol, {});
    }
    for (const symbol of dividendSymbols) {
      if (!symbolMap.has(symbol)) symbolMap.set(symbol, {});
    }

    // Fill in ISINs from the compound-index results.
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
        detected:
          detectedMaps.gains.get(symbol) ?? isinToCountry({ isin: info.isin }),
        detectedDividends:
          detectedMaps.dividends.get(symbol) ??
          isinToCountry({ isin: info.isin }),
        override: overrideMap.get(symbol)?.country ?? '',
        overrideScope: overrideMap.get(symbol)?.scope ?? 'both',
      });
    }

    return result.toSorted((a, b) => a.symbol.localeCompare(b.symbol));
  });

  async function saveOverride(
    symbol: string,
    value: string,
    scope: OverrideScope,
  ) {
    await setSymbolCountryOverride({ sessionId, symbol, country: value, scope });
  }

  function scopeLabel(scope: OverrideScope): string {
    if (scope === 'dividends') return m.data_country_scope_dividends();
    if (scope === 'gains') return m.data_country_scope_gains();
    return m.data_country_scope_both();
  }

  /** Country the dividend treaty cap is looked up for. */
  function dividendCountry(entry: SymbolEntry): string {
    return entry.override && entry.overrideScope !== 'gains'
      ? entry.override
      : entry.detectedDividends;
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
            {@const dttRate = getDividendCreditCapRate({ country: dividendCountry(entry) })}
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
              <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{entry.detected}{#if entry.detectedDividends !== entry.detected}
                  <span class="block text-xs text-slate-500 dark:text-slate-400"
                    >{m.data_country_scope_dividends()}: {entry.detectedDividends}</span
                  >
                {/if}</td>
              <td class="px-3 py-2">
                <input
                  type="text"
                  maxlength="2"
                  aria-label={m.data_country_override_placeholder()}
                  class="w-16 rounded border border-slate-300 px-2 py-1 text-xs uppercase dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  placeholder={m.data_country_override_placeholder()}
                  value={entry.override}
                  onchange={(e) => void saveOverride(entry.symbol, e.currentTarget.value, entry.overrideScope)}
                />
                <select
                  aria-label={m.data_country_scope_label()}
                  class="ml-1 rounded border border-slate-300 px-1 py-1 text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  value={entry.overrideScope}
                  disabled={!entry.override}
                  onchange={(e) => void saveOverride(entry.symbol, entry.override, e.currentTarget.value as OverrideScope)}
                >
                  {#each ['both', 'dividends', 'gains'] as const as scope (scope)}
                    <option value={scope}>{scopeLabel(scope)}</option>
                  {/each}
                </select>
              </td>
              <td
                class="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300"
                >{(dttRate * 100).toFixed(0)}%{#if pilSymbols.has(entry.symbol)}
                  <span class="block text-xs text-slate-500 dark:text-slate-400"
                    >{m.data_country_pil_note()}</span
                  >
                {/if}</td
              >
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}
