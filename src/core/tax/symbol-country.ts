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

export type OverrideScope = 'dividends' | 'gains' | 'both';

export interface SymbolCountryOverrideInput {
  symbol: string;
  country: string;
  /** Missing = 'both' (overrides saved before scopes existed). */
  scope?: OverrideScope;
}

/**
 * Builds one symbol → country map for one purpose. `gains` (default) is the
 * ISIN-prefix country: capital gains and PIT/ZG are attributed to the state of
 * the issuer's listing code. `dividends` additionally applies the ADR issuer
 * country (art. 30a ust. 9 updof: the treaty with the dividend's source state).
 * Overrides apply to a map when their scope is that purpose or 'both', and
 * always beat the derived country.
 */
export function buildSymbolCountryMap(args: {
  trades: SymbolCountrySource[];
  dividends: SymbolCountrySource[];
  overrides?: SymbolCountryOverrideInput[];
  /** From `resolveAdrCountries`; used for `scope: 'dividends'` only. */
  adrCountries?: ReadonlyMap<string, string>;
  scope?: 'dividends' | 'gains';
}): Map<string, string> {
  const scope = args.scope ?? 'gains';
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

  if (scope === 'dividends') {
    for (const [symbol, country] of args.adrCountries ?? []) {
      symbolCountryMap.set(symbol, country);
    }
  }

  for (const override of args.overrides ?? []) {
    const overrideScope = override.scope ?? 'both';
    if (overrideScope === 'both' || overrideScope === scope) {
      symbolCountryMap.set(override.symbol, override.country);
    }
  }

  return symbolCountryMap;
}

/** The two maps the tax calculation needs; see `buildSymbolCountryMap`. */
export function buildSymbolCountryMaps(args: {
  trades: SymbolCountrySource[];
  dividends: (SymbolCountrySource & AdrCountrySource)[];
  overrides?: SymbolCountryOverrideInput[];
}): {
  gains: Map<string, string>;
  dividends: Map<string, string>;
  /** ADR symbols whose rows disagree on the issuer country. */
  adrConflicts: Set<string>;
} {
  const adr = resolveAdrCountries({ dividends: args.dividends });
  return {
    gains: buildSymbolCountryMap({ ...args, scope: 'gains' }),
    dividends: buildSymbolCountryMap({
      ...args,
      scope: 'dividends',
      adrCountries: adr.countries,
    }),
    adrConflicts: adr.conflicts,
  };
}
