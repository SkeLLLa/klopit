import { isinToCountry } from './country.js';

export interface SymbolCountrySource {
  symbol: string;
  isin?: string;
}

export interface AdrCountrySource {
  symbol: string;
  /** Issuer country of an ADR, from the broker's withholding description. */
  adrCountry?: string;
}

/**
 * Collects ADR issuer countries per symbol. Rows that disagree (e.g. two
 * statements) are not resolved by order: the symbol is reported in `conflicts`
 * and gets no entry, so it falls back to the ISIN country.
 */
export function resolveAdrCountries(args: { dividends: AdrCountrySource[] }): {
  countries: Map<string, string>;
  conflicts: Set<string>;
} {
  const countries = new Map<string, string>();
  const conflicts = new Set<string>();
  for (const div of args.dividends) {
    if (!div.adrCountry) continue;
    const existing = countries.get(div.symbol);
    if (existing && existing !== div.adrCountry) conflicts.add(div.symbol);
    else countries.set(div.symbol, div.adrCountry);
  }
  for (const symbol of conflicts) countries.delete(symbol);
  return { countries, conflicts };
}

function setDetectedCountry(args: {
  map: Map<string, string>;
  symbol: string;
  isin?: string;
}) {
  const country = isinToCountry({ isin: args.isin });
  const existing = args.map.get(args.symbol);

  if (!existing || (existing === 'XX' && country !== 'XX')) {
    args.map.set(args.symbol, country);
  }
}

export function buildSymbolCountryMap(args: {
  trades: SymbolCountrySource[];
  dividends: SymbolCountrySource[];
  overrides?: { symbol: string; country: string }[];
  /** From `resolveAdrCountries`; beats the ISIN country, loses to overrides. */
  adrCountries?: ReadonlyMap<string, string>;
}): Map<string, string> {
  const symbolCountryMap = new Map<string, string>();

  for (const trade of args.trades) {
    setDetectedCountry({
      map: symbolCountryMap,
      symbol: trade.symbol,
      isin: trade.isin,
    });
  }

  for (const div of args.dividends) {
    setDetectedCountry({
      map: symbolCountryMap,
      symbol: div.symbol,
      isin: div.isin,
    });
  }

  // Derived ADR issuer country beats the ISIN (US for ADRs), but never a user override.
  for (const [symbol, country] of args.adrCountries ?? []) {
    symbolCountryMap.set(symbol, country);
  }

  for (const override of args.overrides ?? []) {
    symbolCountryMap.set(override.symbol, override.country);
  }

  return symbolCountryMap;
}
