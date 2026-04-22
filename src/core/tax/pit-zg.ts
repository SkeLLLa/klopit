import type { DividendResult, PitZgFields, TradeResult } from '../types.js';

export interface BuildPitZgArgs {
  trades: TradeResult[];
  dividends: DividendResult[];
  includeAll: boolean;
}

export function buildPitZg(args: BuildPitZgArgs): PitZgFields[] {
  const { trades, dividends, includeAll } = args;
  const countries = new Map<string, PitZgFields>();

  for (const div of dividends) {
    if (!includeAll && div.withholdingTaxPln <= 0) continue;
    let entry = countries.get(div.country);
    if (!entry) {
      entry = {
        country: div.country,
        dividendIncomePln: 0,
        dividendForeignTaxPln: 0,
        deductibleDividendTaxPln: 0,
      };
      countries.set(div.country, entry);
    }
    entry.dividendIncomePln += div.amountPln;
    entry.dividendForeignTaxPln += div.withholdingTaxPln;
    entry.deductibleDividendTaxPln += div.deductibleWithholdingPln;
  }

  for (const trade of trades) {
    if (trade.type !== 'sell') continue;
    if (!includeAll && trade.foreignTaxPln <= 0) continue;

    let entry = countries.get(trade.country);
    if (!entry) {
      entry = {
        country: trade.country,
        dividendIncomePln: 0,
        dividendForeignTaxPln: 0,
        deductibleDividendTaxPln: 0,
      };
      countries.set(trade.country, entry);
    }

    entry.proceedsPln = (entry.proceedsPln ?? 0) + trade.proceedsPln;
    entry.costPln = (entry.costPln ?? 0) + trade.costPln;
    entry.tradeForeignTaxPln =
      (entry.tradeForeignTaxPln ?? 0) + trade.foreignTaxPln;
  }

  for (const entry of countries.values()) {
    if (entry.proceedsPln !== undefined && entry.costPln !== undefined) {
      const net = entry.proceedsPln - entry.costPln;
      entry.gainPln = Math.max(net, 0);
      entry.lossPln = Math.max(-net, 0);
    }
  }

  const filtered = includeAll
    ? [...countries.values()]
    : [...countries.values()].filter(
        (entry) =>
          entry.dividendForeignTaxPln > 0 || (entry.tradeForeignTaxPln ?? 0) > 0,
      );

  return filtered.sort((a, b) => a.country.localeCompare(b.country));
}
