import {
  type DividendResult,
  type PitZgFields,
  type TradeResult,
} from '../types.js';
import { getPolishCountryName } from './country-names.js';
import { roundToGrosz } from './rounding.js';

export interface BuildPitZgArgs {
  trades: TradeResult[];
  dividends: DividendResult[];
  showDividends: boolean;
  /** PIT-38 poz. 33: 19% of rounded poz. 31. */
  taxBeforeCreditPln: number;
  /** PIT-38 poz. 28: net income before loss carry-forward. */
  totalIncomePln: number;
}

export function buildPitZg(args: BuildPitZgArgs): PitZgFields[] {
  const {
    trades,
    dividends,
    showDividends,
    taxBeforeCreditPln,
    totalIncomePln,
  } = args;
  const countries = new Map<string, PitZgFields>();
  const paidByCountry = new Map<string, number>();

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
    paidByCountry.set(
      trade.country,
      (paidByCountry.get(trade.country) ?? 0) + trade.foreignTaxPln,
    );
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
      if (div.isInfo) continue;
      const entry = getEntry(div.country);
      entry.dividendIncomePln = (entry.dividendIncomePln ?? 0) + div.amountPln;
      entry.dividendForeignTaxPln =
        (entry.dividendForeignTaxPln ?? 0) + div.withholdingTaxPln;
      entry.deductibleDividendTaxPln =
        (entry.deductibleDividendTaxPln ?? 0) + div.deductibleWithholdingPln;
    }
  }

  // PIT/ZG is required only where a foreign tax is actually credited
  // (art. 30b ust. 5a/5b updof). Per-country limit (treaty credit articles):
  // L_c = T * min(D_c / D, 1), where D_c is the net income of the sells that
  // carried foreign tax. Overall limit (ust. 5a): L = T * min(D_abroad / D, 1);
  // when it binds, per-country credits are scaled down proportionally.
  // Dividend-only compatibility rows are never required: dividends are
  // credited in PIT-38 section G (art. 30a).
  const allSells = trades.filter((trade) => trade.type === 'sell');
  const income = totalIncomePln;
  const tax = taxBeforeCreditPln;
  const abroadIncome = Math.max(
    allSells
      .filter((t) => t.country !== 'PL' && t.country !== 'XX')
      .reduce((sum, t) => sum + (t.proceedsPln - t.costPln), 0),
    0,
  );
  const overallLimit =
    income > 0 ? tax * Math.min(abroadIncome / income, 1) : 0;

  let totalCredit = 0;
  for (const entry of countries.values()) {
    const taxedIncome = Math.max(
      allSells
        .filter((t) => t.country === entry.country && t.foreignTaxPln > 0)
        .reduce((sum, t) => sum + (t.proceedsPln - t.costPln), 0),
      0,
    );
    // No credit for Poland or an unknown country. The paid tax is the raw sum
    // of the taxed sells: a net-loss country shows 0 in poz. 30 (display) but
    // its taxed sells still count against the limit.
    const limit =
      income > 0 && entry.country !== 'PL' && entry.country !== 'XX'
        ? tax * Math.min(taxedIncome / income, 1)
        : 0;
    entry.creditableForeignTaxPln = Math.max(
      Math.min(paidByCountry.get(entry.country) ?? 0, limit),
      0,
    );
    totalCredit += entry.creditableForeignTaxPln;
  }
  const cap = Math.min(overallLimit, tax);
  const scale = totalCredit > cap && totalCredit > 0 ? cap / totalCredit : 1;
  for (const entry of countries.values()) {
    entry.creditableForeignTaxPln =
      (entry.creditableForeignTaxPln ?? 0) * scale;
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

/** Sum of creditable foreign tax on gains: PIT-38 poz. 34. */
export function creditableGainsForeignTaxPln(list: PitZgFields[]): number {
  return roundToGrosz({
    amount: list.reduce((sum, e) => sum + (e.creditableForeignTaxPln ?? 0), 0),
  });
}
