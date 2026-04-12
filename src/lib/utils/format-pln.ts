import { getBcp47Locale } from './format-date.js';

const fmtCache: Record<string, Intl.NumberFormat> = {};

function plnFormatter(): Intl.NumberFormat {
  const locale = getBcp47Locale();
  return (fmtCache[locale] ??= new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }));
}

/** Format a number as PLN amount: "1 234,56 zl" */
export function formatPln(amount: number): string {
  return `${plnFormatter().format(amount)} zl`;
}

/** Format a number as PLN amount without suffix: "1 234,56" */
export function formatPlnValue(amount: number): string {
  return plnFormatter().format(amount);
}
