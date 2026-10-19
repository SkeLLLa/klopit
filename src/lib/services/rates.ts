import {
  fetchRates,
  NbpRateNotYetPublishedError,
  type NbpRate,
  type NbpRateMap,
} from '../../core/nbp.js';
import { db, type NbpRateRecord } from '../db.js';
import { createLogger } from '../state/logger.svelte.js';

const log = createLogger('rates');

const PREFETCH_DAYS_BEFORE = 14;
const PREFETCH_DAYS_AFTER = 78; // 14 + 78 + 1 = 93 (max NBP range)
const PREFETCH_WINDOW_DAYS = PREFETCH_DAYS_BEFORE + PREFETCH_DAYS_AFTER + 1;
const MAX_WALK_BACK_DAYS = 14;
const TRADE_SETTLEMENT_BUSINESS_DAYS = 2;

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

function addBusinessDays(d: Date, days: number): Date {
  const result = new Date(d);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) {
      remaining--;
    }
  }
  return result;
}

function eachDay(start: Date, end: Date): string[] {
  const days: string[] = [];
  const current = new Date(start);
  // oxlint-disable-next-line eslint/no-unmodified-loop-condition -- `current` is a Date mutated in place via setDate()
  while (current <= end) {
    days.push(toDateString(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

/**
 * Current calendar day in Poland (YYYY-MM-DD). NBP publishes table A on
 * business days around midday Warsaw time; the API rejects (400) any range
 * ending after this day and answers 404 for today until publication.
 */
export function todayInWarsaw(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function makeRecordId(args: { currency: string; date: string }): string {
  return `${args.currency}:${args.date}`;
}

// ---------------------------------------------------------------------------
// Cache layer
// ---------------------------------------------------------------------------

/**
 * Whether a cached record can be trusted without refetching. Real rates are
 * always final. A `null` (no table that day) is final only if it was fetched on
 * a later Warsaw day than the date it describes; otherwise it may be a "not
 * published yet" answer (or a legacy record without `fetchedAt`).
 */
function isAuthoritative(rec: NbpRateRecord): boolean {
  return (
    rec.rate !== null ||
    (rec.fetchedAt !== undefined && rec.fetchedAt > rec.date)
  );
}

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
    if (rec && isAuthoritative(rec)) {
      map.set(rec.date, rec);
    }
  }
  return map;
}

/**
 * Store the rates of a fetched span. A missing rate is stored as `null` only
 * for days strictly before `today` (a real weekend/holiday, since NBP publishes
 * the same day); today and later stay uncached ("not yet known"). Returns the
 * stored records.
 */
async function storeRates(args: {
  currency: string;
  dates: string[];
  rateMap: NbpRateMap;
  today: string;
}): Promise<NbpRateRecord[]> {
  const records: NbpRateRecord[] = [];
  for (const date of args.dates) {
    const rate = args.rateMap.get(date);
    if (rate === undefined && date >= args.today) continue;
    records.push({
      id: makeRecordId({ currency: args.currency, date }),
      currency: args.currency,
      date,
      rate: rate?.rate ?? null,
      table: rate?.table ?? '',
      fetchedAt: args.today,
    });
  }
  await db.nbpRates.bulkPut(records);
  return records;
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
  let prev: string | null = null;

  for (const date of args.dates) {
    if (!args.cached.has(date)) {
      spanStart ??= date;
    } else if (spanStart !== null && prev !== null) {
      spans.push({ start: spanStart, end: prev });
      spanStart = null;
    }
    prev = date;
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

  const today = todayInWarsaw();
  const allDates = eachDay(parseDate(args.startDate), parseDate(args.endDate));
  const cached = await loadCachedRecords({
    currency: upperCurrency,
    dates: allDates,
  });

  // NBP rejects ranges ending after today (400), so dates after today are
  // never fetched or stored; they resolve to `undefined` below.
  const fetchableDates = allDates.filter((date) => date <= today);
  const uncachedSpans = findUncachedSpans({ dates: fetchableDates, cached });

  if (uncachedSpans.length > 0) {
    log.debug(
      `getCachedRates(${upperCurrency}): ${String(uncachedSpans.length)} uncached span(s) over ${String(allDates.length)} days`,
    );
  }

  for (const span of uncachedSpans) {
    log.debug(
      `getCachedRates(${upperCurrency}): fetching ${span.start}..${span.end}`,
    );
    // Spans are fetched sequentially on purpose to avoid hammering the rate-limited NBP API.
    // oxlint-disable-next-line eslint/no-await-in-loop
    const fetched = await fetchRates({
      currency: upperCurrency,
      startDate: span.start,
      endDate: span.end,
    });

    // oxlint-disable-next-line eslint/no-await-in-loop -- persist each span before fetching the next
    const stored = await storeRates({
      currency: upperCurrency,
      dates: eachDay(parseDate(span.start), parseDate(span.end)),
      rateMap: fetched,
      today,
    });

    // Merge into cached map so subsequent logic sees them (provisional
    // dates were not stored and stay absent, i.e. `undefined`)
    for (const rec of stored) {
      cached.set(rec.date, rec);
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
 * Get the NBP fixing rate for a reference date.
 *
 * Per Polish tax law, uses the average NBP rate from the last business day
 * BEFORE the reference date. Walks backwards skipping weekends and confirmed
 * holidays (cached as `rate: null`). If a date has no cache entry (gap),
 * triggers a prefetch before continuing.
 *
 * Throws `NbpRateNotYetPublishedError` when the required business day is today
 * (before publication) or in the future, instead of walking back to an older,
 * legally wrong rate.
 */
export async function getFixingRate(args: {
  currency: string;
  date: string;
  settlementBusinessDays?: number;
}): Promise<NbpRate> {
  const upperCurrency = args.currency.toUpperCase();

  if (upperCurrency === 'PLN') {
    return { date: args.date, rate: 1, currency: 'PLN', table: '' };
  }

  const referenceDate =
    args.settlementBusinessDays === undefined
      ? parseDate(args.date)
      : addBusinessDays(parseDate(args.date), args.settlementBusinessDays);
  const referenceDateStr = toDateString(referenceDate);
  const today = todayInWarsaw();
  let candidate = addDays(referenceDate, -1);

  for (let i = 0; i < MAX_WALK_BACK_DAYS; i++) {
    const dateStr = toDateString(candidate);

    // Skip weekends without hitting the cache
    if (isWeekend(candidate)) {
      candidate = addDays(candidate, -1);
      continue;
    }

    // Check cache for this specific date
    const recordId = makeRecordId({ currency: upperCurrency, date: dateStr });
    // oxlint-disable-next-line eslint/no-await-in-loop -- walk-back is inherently sequential (stops at first business day with a rate)
    const record = await db.nbpRates.get(recordId);

    if (record !== undefined && isAuthoritative(record)) {
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

    if (dateStr > today) {
      // The required table cannot exist yet; never request it (NBP: 400).
      throw new NbpRateNotYetPublishedError({
        currency: upperCurrency,
        date: dateStr,
      });
    }

    // Cache miss — gap detected, prefetch a range around this date. The end
    // is clamped to today; the start then moves back to keep the full
    // 93-day window (still a single NBP request).
    let prefetchStart = toDateString(addDays(candidate, -PREFETCH_DAYS_BEFORE));
    let prefetchEnd = toDateString(addDays(candidate, PREFETCH_DAYS_AFTER));
    if (prefetchEnd > today) {
      prefetchEnd = today;
      prefetchStart = toDateString(
        addDays(parseDate(today), -(PREFETCH_WINDOW_DAYS - 1)),
      );
    }

    // oxlint-disable-next-line eslint/no-await-in-loop -- walk-back is inherently sequential
    await getCachedRates({
      currency: upperCurrency,
      startDate: prefetchStart,
      endDate: prefetchEnd,
    });

    // Re-check the same date now that it's cached
    // oxlint-disable-next-line eslint/no-await-in-loop -- walk-back is inherently sequential
    const freshRecord = await db.nbpRates.get(recordId);

    if (freshRecord !== undefined && freshRecord.rate !== null) {
      return {
        date: freshRecord.date,
        rate: freshRecord.rate,
        currency: freshRecord.currency,
        table: freshRecord.table,
      };
    }

    if (dateStr === today) {
      // Today's table is not out yet (published around midday Warsaw time).
      throw new NbpRateNotYetPublishedError({
        currency: upperCurrency,
        date: dateStr,
      });
    }

    // Still null (holiday) or somehow missing — walk back
    candidate = addDays(candidate, -1);
  }

  log.warn(
    `getFixingRate: gave up walking back ${String(MAX_WALK_BACK_DAYS)} days for ${upperCurrency} before ${referenceDateStr}`,
  );
  throw new Error(
    `Could not find NBP fixing rate for ${upperCurrency} within ${String(MAX_WALK_BACK_DAYS)} days before ${referenceDateStr}`,
  );
}

/**
 * Get the NBP fixing rate using an estimated T+2 settlement date for securities
 * trades.
 */
export async function getTradeSettlementFixingRate(args: {
  currency: string;
  date: string;
}): Promise<NbpRate> {
  return getFixingRate({
    ...args,
    settlementBusinessDays: TRADE_SETTLEMENT_BUSINESS_DAYS,
  });
}

/**
 * Collect all unique (currency, date) pairs from session data and prefetch
 * rates
 */
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

  if (currencies.size === 0) {
    log.debug('fetchRatesForSession: no foreign currencies, skipping');
    return;
  }

  // Find the overall date range across all transactions
  const allDates: Date[] = [];
  for (const t of trades) allDates.push(t.datetime);
  for (const d of dividends) allDates.push(d.date);
  for (const interest of creditInterests) allDates.push(interest.date);
  for (const ca of corporateActions) allDates.push(ca.datetime);

  if (allDates.length === 0) return;

  allDates.sort((a, b) => a.getTime() - b.getTime());

  // Extend range for fixing rate walk-back and optional T+2 trade settlement.
  const earliest = addDays(allDates[0], -PREFETCH_DAYS_BEFORE);
  const latest = addBusinessDays(
    allDates[allDates.length - 1],
    TRADE_SETTLEMENT_BUSINESS_DAYS,
  );

  const today = todayInWarsaw();
  const startDate = toDateString(earliest);
  const latestStr = toDateString(latest);
  // Never request past today (NBP: 400); getCachedRates clamps as well.
  const endDate = latestStr > today ? today : latestStr;
  if (startDate > endDate) return;

  // Prefetch rates for each currency in parallel. This is only an
  // optimisation (per-row lookups retry), so it never throws.
  const currencyList = [...currencies];
  log.info(
    `fetchRatesForSession: prefetching ${currencyList.join(',')} from ${startDate} to ${endDate}`,
  );
  const results = await Promise.allSettled(
    currencyList.map((currency) =>
      getCachedRates({ currency, startDate, endDate }),
    ),
  );
  results.forEach((res, i) => {
    if (res.status === 'rejected') {
      log.warn(
        `fetchRatesForSession: prefetch failed for ${currencyList[i]}`,
        res.reason,
      );
    }
  });
}

/** Clear the NBP rate cache */
export async function clearRateCache(): Promise<void> {
  await db.nbpRates.clear();
}
