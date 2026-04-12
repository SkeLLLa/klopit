import { getLocale } from '$lib/paraglide/runtime';

const localeMap: Record<string, string> = {
  en: 'en-GB',
  pl: 'pl-PL',
  uk: 'uk-UA',
};

export function getBcp47Locale(): string {
  return localeMap[getLocale()] ?? 'en-GB';
}

// ---------------------------------------------------------------------------
// Cached Intl.DateTimeFormat instances (one per locale)
// ---------------------------------------------------------------------------

const dateFmtCache: Record<string, Intl.DateTimeFormat> = {};
const datetimeFmtCache: Record<string, Intl.DateTimeFormat> = {};

function dateFormatter(): Intl.DateTimeFormat {
  const locale = getBcp47Locale();
  return (dateFmtCache[locale] ??= new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }));
}

function datetimeFormatter(): Intl.DateTimeFormat {
  const locale = getBcp47Locale();
  return (datetimeFmtCache[locale] ??= new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }));
}

/** Convert a Date or ISO date string to a Date in local time. */
function toLocal(d: Date | string): Date {
  if (d instanceof Date) return d;
  // Append time to avoid UTC interpretation of date-only strings
  if (d.length === 10) return new Date(d + 'T00:00:00');
  return new Date(d);
}

export function formatDate(d: Date | string): string {
  return dateFormatter().format(toLocal(d));
}

export function formatDatetime(d: Date | string): string {
  return datetimeFormatter().format(toLocal(d));
}

/** Placeholder string showing the expected datetime format for the current locale. */
export function datetimePlaceholder(): string {
  const locale = getBcp47Locale();
  if (locale === 'en-GB') return 'DD/MM/YYYY, HH:mm';
  return 'DD.MM.YYYY, HH:mm';
}

/** Placeholder string showing the expected date format for the current locale. */
export function datePlaceholder(): string {
  const locale = getBcp47Locale();
  if (locale === 'en-GB') return 'DD/MM/YYYY';
  return 'DD.MM.YYYY';
}

/**
 * Parse a locale-formatted datetime string (e.g. "11/04/2026, 14:30" or "11.04.2026, 14:30")
 * into a Date. Accepts `/`, `.`, or `-` as date separators. Returns null if unparseable.
 */
const datetimeRe =
  /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})[,\s]+(\d{1,2}):(\d{2})$/;

export function parseDatetime(input: string): Date | null {
  const result = datetimeRe.exec(input.trim());
  if (!result) return null;
  const [, day, month, year, hour, minute] = result;
  const d = new Date(+year, +month - 1, +day, +hour, +minute);
  if (isNaN(d.getTime())) return null;
  return d;
}

/**
 * Parse a locale-formatted date string (e.g. "11/04/2026" or "11.04.2026")
 * into a Date. Returns null if unparseable.
 */
const dateRe = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/;

export function parseDate(input: string): Date | null {
  const result = dateRe.exec(input.trim());
  if (!result) return null;
  const [, day, month, year] = result;
  const d = new Date(+year, +month - 1, +day);
  if (isNaN(d.getTime())) return null;
  return d;
}

/** Format a Date to the ISO datetime-local value (YYYY-MM-DDTHH:mm) for native inputs. */
export function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const Y = String(d.getFullYear());
  const M = pad(d.getMonth() + 1);
  const D = pad(d.getDate());
  const h = pad(d.getHours());
  const m = pad(d.getMinutes());
  return `${Y}-${M}-${D}T${h}:${m}`;
}

/** Format a Date to the ISO date value (YYYY-MM-DD) for native inputs. */
export function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const Y = String(d.getFullYear());
  const M = pad(d.getMonth() + 1);
  const D = pad(d.getDate());
  return `${Y}-${M}-${D}`;
}
