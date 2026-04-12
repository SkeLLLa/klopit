import {
  TAX_RATE,
  type DividendResult,
  type PitZgFields,
  type TradeResult,
} from '../types.js';

export interface BuildPitZgArgs {
  trades: TradeResult[];
  dividends: DividendResult[];
}

/** Build per-country PIT/ZG attachment fields from calculated results */
export function buildPitZg(args: BuildPitZgArgs): PitZgFields[] {
  const { trades, dividends } = args;
  const countries = new Map<string, PitZgFields>();

  function getOrCreate(country: string): PitZgFields {
    let entry = countries.get(country);
    if (!entry) {
      entry = {
        country,
        proceedsPln: 0,
        costPln: 0,
        gainPln: 0,
        lossPln: 0,
        dividendIncomePln: 0,
        foreignTaxPaidPln: 0,
        deductibleForeignTaxPln: 0,
      };
      countries.set(country, entry);
    }
    return entry;
  }

  // Aggregate sell trades by country
  for (const trade of trades) {
    if (trade.type !== 'sell') continue;
    const entry = getOrCreate(trade.country);
    entry.proceedsPln += trade.proceedsPln;
    entry.costPln += trade.costPln;
  }

  // Compute gain/loss per country
  for (const entry of countries.values()) {
    const net = entry.proceedsPln - entry.costPln;
    entry.gainPln = Math.max(net, 0);
    entry.lossPln = Math.max(-net, 0);
  }

  // Aggregate dividends by country
  for (const div of dividends) {
    const entry = getOrCreate(div.country);
    entry.dividendIncomePln += div.amountPln;
    entry.foreignTaxPaidPln += div.withholdingTaxPln;
    // Per-dividend withholding cap (art. 30a ust. 9)
    entry.deductibleForeignTaxPln += Math.min(
      div.withholdingTaxPln,
      div.amountPln * TAX_RATE,
    );
  }

  // Sort by country code and return
  return [...countries.values()].sort((a, b) =>
    a.country.localeCompare(b.country),
  );
}
