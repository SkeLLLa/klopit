import { fetchRates, type NbpRate, type NbpRateMap } from '../../core/nbp.js';
import { db, type NbpRateRecord } from '../db.js';

const PREFETCH_DAYS_BEFORE = 14;
const PREFETCH_DAYS_AFTER = 78; // 14 + 78 + 1 = 93 (max NBP range)
const MAX_WALK_BACK_DAYS = 14;

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${String(year)}-${month}-${day}`;
}

function parseDate(s: string): Date {
  const [year, month, day] = s.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

function isWeekend(d: Date): boolean {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

function eachDay(start: Date, end: Date): string[] {
  const days: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    days.push(toDateString(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function makeRecordId(args: { currency: string; date: string }): string {
  return `${args.currency}:${args.date}`;
}

// ---------------------------------------------------------------------------
// Cache layer
// ---------------------------------------------------------------------------

async function loadCachedRecords(args: {
  currency: string;
  dates: string[];
}): Promise<Map<string, NbpRateRecord>> {
  const ids = args.dates.map((date) =>
    makeRecordId({ currency: args.currency, date }),
  );
  const records = await db.nbpRates.bulkGet(ids);
  const map = new Map<string, NbpRateRecord>();
  for (const rec of records) {
    if (rec) {
      map.set(rec.date, rec);
    }
  }
  return map;
}

async function storeRates(args: {
  currency: string;
  dates: string[];
  rateMap: NbpRateMap;
}): Promise<void> {
  const records: NbpRateRecord[] = args.dates.map((date) => {
    const rate = args.rateMap.get(date);
    return {
      id: makeRecordId({ currency: args.currency, date }),
      currency: args.currency,
      date,
      rate: rate?.rate ?? null,
      table: rate?.table ?? '',
    };
  });
  await db.nbpRates.bulkPut(records);
}

// ---------------------------------------------------------------------------
// Find contiguous uncached spans
// ---------------------------------------------------------------------------

function findUncachedSpans(args: {
  dates: string[];
  cached: Map<string, NbpRateRecord>;
}): { start: string; end: string }[] {
  const spans: { start: string; end: string }[] = [];
  let spanStart: string | null = null;

  for (const date of args.dates) {
    if (!args.cached.has(date)) {
      spanStart ??= date;
    } else {
      if (spanStart !== null) {
        const prevIdx = args.dates.indexOf(date) - 1;
        spans.push({ start: spanStart, end: args.dates[prevIdx] });
        spanStart = null;
      }
    }
  }

  if (spanStart !== null) {
    spans.push({ start: spanStart, end: args.dates[args.dates.length - 1] });
  }

  return spans;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Fetch rates for a date range with IndexedDB caching */
export async function getCachedRates(args: {
  currency: string;
  startDate: string;
  endDate: string;
}): Promise<NbpRateMap> {
  const upperCurrency = args.currency.toUpperCase();

  if (upperCurrency === 'PLN') {
    const result: NbpRateMap = new Map();
    for (const day of eachDay(
      parseDate(args.startDate),
      parseDate(args.endDate),
    )) {
      result.set(day, { date: day, rate: 1, currency: 'PLN', table: '' });
    }
    return result;
  }

  const allDates = eachDay(parseDate(args.startDate), parseDate(args.endDate));
  const cached = await loadCachedRecords({
    currency: upperCurrency,
    dates: allDates,
  });

  const uncachedSpans = findUncachedSpans({ dates: allDates, cached });

  for (const span of uncachedSpans) {
    const fetched = await fetchRates({
      currency: upperCurrency,
      startDate: span.start,
      endDate: span.end,
    });

    const spanDates = eachDay(parseDate(span.start), parseDate(span.end));
    await storeRates({
      currency: upperCurrency,
      dates: spanDates,
      rateMap: fetched,
    });

    // Merge into cached map so subsequent logic sees them
    for (const date of spanDates) {
      const rate = fetched.get(date);
      cached.set(date, {
        id: makeRecordId({ currency: upperCurrency, date }),
        currency: upperCurrency,
        date,
        rate: rate?.rate ?? null,
        table: rate?.table ?? '',
      });
    }
  }

  // Build result NbpRateMap from cached records
  const result: NbpRateMap = new Map();
  for (const date of allDates) {
    const rec = cached.get(date);
    if (rec && rec.rate !== null) {
      result.set(date, {
        date: rec.date,
        rate: rec.rate,
        currency: rec.currency,
        table: rec.table,
      });
    } else {
      result.set(date, undefined);
    }
  }

  return result;
}

/**
 * Get the NBP fixing rate for a transaction.
 *
 * Per Polish tax law, uses the average NBP rate from the last business day
 * BEFORE the transaction date. Walks backwards skipping weekends and
 * confirmed holidays (cached as `rate: null`). If a date has no cache
 * entry (gap), triggers a prefetch before continuing.
 */
export async function getFixingRate(args: {
  currency: string;
  date: string;
}): Promise<NbpRate> {
  const upperCurrency = args.currency.toUpperCase();

  if (upperCurrency === 'PLN') {
    return { date: args.date, rate: 1, currency: 'PLN', table: '' };
  }

  const txDate = parseDate(args.date);
  let candidate = addDays(txDate, -1);

  for (let i = 0; i < MAX_WALK_BACK_DAYS; i++) {
    const dateStr = toDateString(candidate);

    // Skip weekends without hitting the cache
    if (isWeekend(candidate)) {
      candidate = addDays(candidate, -1);
      continue;
    }

    // Check cache for this specific date
    const recordId = makeRecordId({ currency: upperCurrency, date: dateStr });
    const record = await db.nbpRates.get(recordId);

    if (record !== undefined) {
      // Cache hit — either a real rate or confirmed holiday (null)
      if (record.rate !== null) {
        return {
          date: record.date,
          rate: record.rate,
          currency: record.currency,
          table: record.table,
        };
      }
      // rate is null → confirmed holiday, walk back further
      candidate = addDays(candidate, -1);
      continue;
    }

    // Cache miss — gap detected, prefetch a range around this date
    const prefetchStart = toDateString(
      addDays(candidate, -PREFETCH_DAYS_BEFORE),
    );
    const prefetchEnd = toDateString(addDays(candidate, PREFETCH_DAYS_AFTER));

    await getCachedRates({
      currency: upperCurrency,
      startDate: prefetchStart,
      endDate: prefetchEnd,
    });

    // Re-check the same date now that it's cached
    const freshRecord = await db.nbpRates.get(recordId);

    if (freshRecord !== undefined && freshRecord.rate !== null) {
      return {
        date: freshRecord.date,
        rate: freshRecord.rate,
        currency: freshRecord.currency,
        table: freshRecord.table,
      };
    }

    // Still null (holiday) or somehow missing — walk back
    candidate = addDays(candidate, -1);
  }

  throw new Error(
    `Could not find NBP fixing rate for ${upperCurrency} within ${String(MAX_WALK_BACK_DAYS)} days before ${args.date}`,
  );
}

/** Collect all unique (currency, date) pairs from session data and prefetch rates */
export async function fetchRatesForSession(args: {
  sessionId: string;
}): Promise<void> {
  const [trades, dividends, creditInterests, corporateActions] =
    await Promise.all([
      db.trades.where('sessionId').equals(args.sessionId).toArray(),
      db.dividends.where('sessionId').equals(args.sessionId).toArray(),
      db.creditInterests.where('sessionId').equals(args.sessionId).toArray(),
      db.corporateActions.where('sessionId').equals(args.sessionId).toArray(),
    ]);

  // Collect unique currencies (excluding PLN)
  const currencies = new Set<string>();
  for (const t of trades) {
    const cur = t.currency.toUpperCase();
    const comCur = t.commissionCurrency.toUpperCase();
    if (cur !== 'PLN') currencies.add(cur);
    if (comCur !== 'PLN') currencies.add(comCur);
  }
  for (const d of dividends) {
    const cur = d.currency.toUpperCase();
    if (cur !== 'PLN') currencies.add(cur);
  }
  for (const interest of creditInterests) {
    const cur = interest.currency.toUpperCase();
    if (cur !== 'PLN') currencies.add(cur);
  }
  for (const ca of corporateActions) {
    if (ca.cashCurrency) {
      const cur = ca.cashCurrency.toUpperCase();
      if (cur !== 'PLN') currencies.add(cur);
    }
  }

  if (currencies.size === 0) return;

  // Find the overall date range across all transactions
  const allDates: Date[] = [];
  for (const t of trades) allDates.push(t.datetime);
  for (const d of dividends) allDates.push(d.date);
  for (const interest of creditInterests) allDates.push(interest.date);
  for (const ca of corporateActions) allDates.push(ca.datetime);

  if (allDates.length === 0) return;

  allDates.sort((a, b) => a.getTime() - b.getTime());

  // Extend range: 14 days before earliest (for fixing rate walk-back)
  // and to the last date
  const earliest = addDays(allDates[0], -PREFETCH_DAYS_BEFORE);
  const latest = allDates[allDates.length - 1];

  const startDate = toDateString(earliest);
  const endDate = toDateString(latest);

  // Prefetch rates for each currency in parallel
  await Promise.all(
    [...currencies].map((currency) =>
      getCachedRates({ currency, startDate, endDate }),
    ),
  );
}

/** Clear the NBP rate cache */
export async function clearRateCache(): Promise<void> {
  await db.nbpRates.clear();
}
