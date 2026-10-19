import type { DividendResult, PitZgFields, TradeResult } from '../types.js';
import { getPolishCountryName } from './country-names.js';

export interface BuildPitZgArgs {
  trades: TradeResult[];
  dividends: DividendResult[];
  showDividends: boolean;
}

export function buildPitZg(args: BuildPitZgArgs): PitZgFields[] {
  const { trades, dividends, showDividends } = args;
  const countries = new Map<string, PitZgFields>();

  function getEntry(country: string): PitZgFields {
    let entry = countries.get(country);
    if (!entry) {
      entry = {
        country,
        countryNamePl: getPolishCountryName({ country }),
        required: false,
      };
      countries.set(country, entry);
    }
    return entry;
  }

  for (const trade of trades) {
    if (trade.type !== 'sell') continue;

    const entry = getEntry(trade.country);

    entry.proceedsPln = (entry.proceedsPln ?? 0) + trade.proceedsPln;
    entry.costPln = (entry.costPln ?? 0) + trade.costPln;
    entry.tradeForeignTaxPln =
      (entry.tradeForeignTaxPln ?? 0) + trade.foreignTaxPln;
  }

  for (const entry of countries.values()) {
    const net = (entry.proceedsPln ?? 0) - (entry.costPln ?? 0);
    entry.gainPln = Math.max(net, 0);
    entry.lossPln = Math.max(-net, 0);
    if (entry.gainPln === 0) {
      entry.tradeForeignTaxPln = 0;
    }
  }

  // PIT/ZG is required only where foreign tax on the gain was paid and is
  // credited (art. 30b ust. 5a/5b updof). Country-only dividend rows stay
  // informational as well: dividends are settled in PIT-38 section G.
  for (const entry of countries.values()) {
    entry.required = (entry.tradeForeignTaxPln ?? 0) > 0;
  }

  if (showDividends) {
    for (const div of dividends) {
      const entry = getEntry(div.country);
      entry.dividendIncomePln = (entry.dividendIncomePln ?? 0) + div.amountPln;
      entry.dividendForeignTaxPln =
        (entry.dividendForeignTaxPln ?? 0) + div.withholdingTaxPln;
      entry.deductibleDividendTaxPln =
        (entry.deductibleDividendTaxPln ?? 0) + div.deductibleWithholdingPln;
    }
  }

  return [...countries.values()].toSorted((a, b) =>
    a.country.localeCompare(b.country),
  );
}

/** PIT/ZG attachments that must actually be filed (foreign tax credited). */
export function requiredPitZg(list: PitZgFields[]): PitZgFields[] {
  return list.filter((entry) => entry.required);
}
