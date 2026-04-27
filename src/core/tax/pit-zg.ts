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

  return [...countries.values()].sort((a, b) =>
    a.country.localeCompare(b.country),
  );
}
