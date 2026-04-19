const NBP_BASE_URL = 'https://api.nbp.pl/api/exchangerates/rates/a';
const MAX_RANGE_DAYS = 93;

export class NbpFetchError extends Error {
  readonly url: string;

  constructor(args: { url: string; message: string; cause?: unknown }) {
    super(args.message, { cause: args.cause });
    this.name = 'NbpFetchError';
    this.url = args.url;
  }
}

export const NBP_FETCH_TIMEOUT_MS = 10_000;

export interface NbpRate {
  date: string;
  rate: number;
  currency: string;
  table: string;
}

export type NbpRateResult = NbpRate | undefined;
export type NbpRateMap = Map<string, NbpRateResult>;

interface NbpApiResponse {
  table: string;
  currency: string;
  code: string;
  rates: { no: string; effectiveDate: string; mid: number }[];
}

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

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
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

function splitIntoChunks(
  startDate: string,
  endDate: string,
): { start: string; end: string }[] {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const totalDays = daysBetween(start, end);

  if (totalDays < 0) {
    throw new Error(
      `Invalid date range: startDate ${startDate} is after endDate ${endDate}`,
    );
  }

  if (totalDays < MAX_RANGE_DAYS) {
    return [{ start: startDate, end: endDate }];
  }

  const chunks: { start: string; end: string }[] = [];
  const current = new Date(start);

  while (current <= end) {
    const chunkEnd = new Date(current);
    chunkEnd.setDate(chunkEnd.getDate() + MAX_RANGE_DAYS - 1);

    if (chunkEnd > end) {
      chunkEnd.setTime(end.getTime());
    }

    chunks.push({ start: toDateString(current), end: toDateString(chunkEnd) });
    current.setDate(current.getDate() + MAX_RANGE_DAYS);
  }

  return chunks;
}

async function fetchChunk(
  currency: string,
  startDate: string,
  endDate: string,
): Promise<NbpApiResponse | undefined> {
  const url =
    startDate === endDate
      ? `${NBP_BASE_URL}/${currency}/${startDate}/?format=json`
      : `${NBP_BASE_URL}/${currency}/${startDate}/${endDate}/?format=json`;

  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(NBP_FETCH_TIMEOUT_MS),
    });
  } catch (cause) {
    const isTimeout =
      cause instanceof DOMException && cause.name === 'TimeoutError';
    throw new NbpFetchError({
      url,
      message: isTimeout
        ? `NBP API request timed out after ${String(NBP_FETCH_TIMEOUT_MS)}ms: ${url}`
        : `NBP API network error for ${url}: ${String(cause)}`,
      cause,
    });
  }

  if (response.status === 404) {
    return undefined;
  }

  if (!response.ok) {
    throw new NbpFetchError({
      url,
      message: `NBP API error: ${String(response.status)} ${response.statusText} for ${url}`,
      cause: response,
    });
  }

  return (await response.json()) as NbpApiResponse;
}

function buildPlnMap(startDate: string, endDate: string): NbpRateMap {
  const map: NbpRateMap = new Map();
  for (const day of eachDay(parseDate(startDate), parseDate(endDate))) {
    map.set(day, { date: day, rate: 1, currency: 'PLN', table: '' });
  }
  return map;
}

export async function fetchRates(args: {
  currency: string;
  startDate: string;
  endDate: string;
}): Promise<NbpRateMap> {
  const upperCurrency = args.currency.toUpperCase();

  if (upperCurrency === 'PLN') {
    return buildPlnMap(args.startDate, args.endDate);
  }

  const chunks = splitIntoChunks(args.startDate, args.endDate);
  const responses = await Promise.all(
    chunks.map((chunk) => fetchChunk(upperCurrency, chunk.start, chunk.end)),
  );

  const ratesByDate = new Map<string, NbpRate>();
  for (const resp of responses) {
    if (!resp) continue;
    for (const entry of resp.rates) {
      ratesByDate.set(entry.effectiveDate, {
        date: entry.effectiveDate,
        rate: entry.mid,
        currency: resp.code,
        table: entry.no,
      });
    }
  }

  const result: NbpRateMap = new Map();
  for (const day of eachDay(
    parseDate(args.startDate),
    parseDate(args.endDate),
  )) {
    result.set(day, ratesByDate.get(day));
  }

  return result;
}

export async function fetchRate(args: {
  currency: string;
  date: string;
}): Promise<NbpRateMap> {
  return fetchRates({
    currency: args.currency,
    startDate: args.date,
    endDate: args.date,
  });
}
