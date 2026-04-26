import type { ParsedStatement, ParseWarning, Trade } from '../../types.js';

export const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

export function parseLongDate(value: string): Date | undefined {
  const match = /^([A-Za-z]+)\s+(\d+),\s+(\d{4})$/.exec(value.trim());
  if (!match) return undefined;
  const monthName = match[1].toLowerCase();
  if (!(monthName in MONTHS)) return undefined;
  const month = MONTHS[monthName];
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isFinite(day) || !Number.isFinite(year)) return undefined;
  return new Date(year, month, day);
}

export type ParsedDate = { ok: true; date: Date } | { ok: false; raw: string };

export function parseLongDateStrict(value: string): ParsedDate {
  const date = parseLongDate(value);
  if (date) return { ok: true, date };
  return { ok: false, raw: value.trim() };
}

export function formatDateLabel(
  label: string,
  result: ParsedDate | undefined,
): string {
  return result && !result.ok
    ? `${label} (unparseable: "${result.raw}")`
    : label;
}

export function parseAmount(raw: string): number {
  return Number(raw.replace(/,/g, ''));
}

export function buildStatement(args: {
  trades: Trade[];
  warnings: ParseWarning[];
  year: number;
}): ParsedStatement {
  return {
    broker: 'ibi',
    brokerCountry: 'IL',
    year: args.year,
    trades: args.trades,
    dividends: [],
    withholdingTaxes: [],
    corporateActions: [],
    carryInPositions: [],
    transactionFees: [],
    creditInterests: [],
    symbolToIsin: new Map(),
    warnings: args.warnings,
    skippedRows: [],
  };
}
