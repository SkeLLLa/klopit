import {
  TAX_RATE,
  type DividendResult,
  type PitZgFields,
  type TradeResult,
} from '../types.js';
import { getPolishCountryName } from './country-names.js';

export interface BuildPitZgArgs {
  trades: TradeResult[];
  dividends: DividendResult[];
  showDividends: boolean;
  /**
   * Polish capital-gains tax actually due after section D offsets and loss
   * carry-forward (poz. 35 base). Caps the credit overall; omitted = no cap.
   */
  polishTaxDuePln?: number | undefined;
}

export function buildPitZg(args: BuildPitZgArgs): PitZgFields[] {
  const { trades, dividends, showDividends, polishTaxDuePln } = args;
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

  // PIT/ZG is required only where a foreign tax is actually credited
  // (art. 30b ust. 5a/5b updof). The credit is capped by the Polish tax on
  // that country's income (19% of its gain) and, proportionally, by the tax
  // really due after loss offsets and carry-forward, so a credit of 0 means
  // not required. Dividend-only compatibility rows are never required:
  // dividends are credited in PIT-38 section G (art. 30a).
  const totalGain = [...countries.values()].reduce(
    (sum, entry) => sum + (entry.gainPln ?? 0),
    0,
  );
  for (const entry of countries.values()) {
    const gain = entry.gainPln ?? 0;
    const paid = entry.tradeForeignTaxPln ?? 0;
    let cap = gain * TAX_RATE;
    if (polishTaxDuePln !== undefined && totalGain > 0) {
      cap = Math.min(cap, (polishTaxDuePln * gain) / totalGain);
    }
    entry.creditableForeignTaxPln = Math.max(Math.min(paid, cap), 0);
    entry.required = entry.creditableForeignTaxPln > 0;
  }

  return [...countries.values()].toSorted((a, b) =>
    a.country.localeCompare(b.country),
  );
}

/** PIT/ZG attachments that must actually be filed (foreign tax credited). */
export function requiredPitZg(list: PitZgFields[]): PitZgFields[] {
  return list.filter((entry) => entry.required);
}
