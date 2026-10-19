import { isinToCountry } from './country.js';

export interface SymbolCountrySource {
  symbol: string;
  isin?: string;
  /** Issuer country of an ADR, from the broker's withholding description. */
  adrCountry?: string;
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
  for (const div of args.dividends) {
    if (div.adrCountry) symbolCountryMap.set(div.symbol, div.adrCountry);
  }

  for (const override of args.overrides ?? []) {
    symbolCountryMap.set(override.symbol, override.country);
  }

  return symbolCountryMap;
}
