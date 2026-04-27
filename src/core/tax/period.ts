import type { TaxPeriod } from '../types.js';

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

export function isInTaxPeriod(args: {
  date: Date;
  taxPeriod: TaxPeriod;
}): boolean {
  return (
    args.date >= startOfDay(args.taxPeriod.from) &&
    args.date <= endOfDay(args.taxPeriod.to)
  );
}
