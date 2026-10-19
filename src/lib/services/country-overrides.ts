import { isinToCountry } from '../../core/tax/country.js';
import {
  buildSymbolCountryMaps,
  type OverrideScope,
} from '../../core/tax/symbol-country.js';
import { db, type SymbolCountryOverrideRecord } from '../db.js';

/**
 * Replace the symbol's country override (one per symbol). An empty country only
 * deletes the existing override.
 */
export async function setSymbolCountryOverride(args: {
  sessionId: string;
  symbol: string;
  country: string;
  scope: OverrideScope;
}): Promise<void> {
  const country = args.country.trim().toUpperCase();
  await db.symbolCountryOverrides
    .where({ sessionId: args.sessionId, symbol: args.symbol })
    .delete();
  if (country.length > 0) {
    await db.symbolCountryOverrides.add({
      sessionId: args.sessionId,
      symbol: args.symbol,
      country,
      scope: args.scope,
    });
  }
}

export interface DividendCountryInfo {
  country: string;
  source: 'isin' | 'session' | 'override' | 'unknown';
  /** Scope of the symbol's override, when one exists. */
  overrideScope?: OverrideScope | undefined;
}

/**
 * The country the calculator would use for an ordinary dividend of `symbol`
 * (same maps as `calculateSessionTaxes`). `isin` is the one being entered,
 * which may not be saved yet. `excludeDividendId` is the dividend being edited:
 * its stored ISIN may be about to change, so it must not count.
 */
export async function resolveDividendCountry(args: {
  sessionId: string;
  symbol: string;
  isin?: string | undefined;
  excludeDividendId?: number | undefined;
}): Promise<DividendCountryInfo> {
  const symbol = args.symbol.trim().toUpperCase();
  const isin = args.isin?.trim() || undefined;
  const [trades, dividends, overrides] = await Promise.all([
    db.trades.where('sessionId').equals(args.sessionId).toArray(),
    db.dividends
      .where('sessionId')
      .equals(args.sessionId)
      .filter((d) => d.id !== args.excludeDividendId)
      .toArray(),
    db.symbolCountryOverrides
      .where('sessionId')
      .equals(args.sessionId)
      .toArray(),
  ]);
  const own: SymbolCountryOverrideRecord | undefined = overrides.find(
    (o) => o.symbol === symbol,
  );
  const overrideScope = own ? (own.scope ?? 'both') : undefined;
  const maps = buildSymbolCountryMaps({
    trades,
    dividends: isin ? [...dividends, { symbol, isin }] : dividends,
    overrides,
  });
  const country = maps.dividends.get(symbol) ?? 'XX';
  if (own && overrideScope !== 'gains') {
    return { country, source: 'override', overrideScope };
  }
  if (country === 'XX') return { country, source: 'unknown', overrideScope };
  const fromIsin = isin !== undefined && isinToCountry({ isin }) === country;
  return {
    country,
    source: fromIsin ? 'isin' : 'session',
    overrideScope,
  };
}
