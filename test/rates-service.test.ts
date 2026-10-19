import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import { NbpRateNotYetPublishedError } from '../src/core/nbp.js';
import { fakeNbp } from './helpers/fake-nbp.js';

(globalThis as unknown as { $state: <T>(value: T) => T }).$state = (value) =>
  value;

const [
  { db },
  {
    clearRateCache,
    fetchRatesForSession,
    getCachedRates,
    getFixingRate,
    getTradeSettlementFixingRate,
    todayInWarsaw,
  },
  { createSession, getSession, updateSession },
] = await Promise.all([
  import('../src/lib/db.js'),
  import('../src/lib/services/rates.js'),
  import('../src/lib/services/session.js'),
]);

async function cacheRate(args: {
  currency: string;
  date: string;
  rate: number;
}) {
  await db.nbpRates.put({
    id: `${args.currency}:${args.date}`,
    currency: args.currency,
    date: args.date,
    rate: args.rate,
    table: `A/${args.date}`,
  });
}

void describe('rates service', () => {
  afterEach(async () => {
    mock.restoreAll();
    await clearRateCache();
    await db.sessions.clear();
    await db.trades.clear();
  });

  void it('keeps ordinary fixing rates tied to the day before the transaction date', async () => {
    await cacheRate({ currency: 'USD', date: '2025-01-02', rate: 4.05 });
    await cacheRate({ currency: 'USD', date: '2025-01-03', rate: 4.1 });

    const rate = await getFixingRate({ currency: 'USD', date: '2025-01-03' });

    assert.equal(rate.date, '2025-01-02');
    assert.equal(rate.rate, 4.05);
  });

  void it('uses the previous NBP business day before estimated T+2 settlement for trades', async () => {
    await cacheRate({ currency: 'USD', date: '2025-01-03', rate: 4.1 });

    const rate = await getTradeSettlementFixingRate({
      currency: 'USD',
      date: '2025-01-02',
    });

    assert.equal(rate.date, '2025-01-03');
    assert.equal(rate.rate, 4.1);
  });

  void it('skips weekends while estimating T+2 settlement dates', async () => {
    await cacheRate({ currency: 'USD', date: '2025-01-06', rate: 4.2 });

    const rate = await getTradeSettlementFixingRate({
      currency: 'USD',
      date: '2025-01-03',
    });

    assert.equal(rate.date, '2025-01-06');
    assert.equal(rate.rate, 4.2);
  });

  void it('reports missing trade settlement rates against the settlement reference date', async () => {
    mock.method(globalThis, 'fetch', async () => {
      return new Response(
        JSON.stringify({
          table: 'A',
          currency: 'dolar amerykanski',
          code: 'USD',
          rates: [],
        }),
        {
          headers: { 'content-type': 'application/json' },
          status: 200,
        },
      );
    });

    await assert.rejects(
      getTradeSettlementFixingRate({
        currency: 'USD',
        date: '2025-01-03',
      }),
      /before 2025-01-07/,
    );
  });

  void it('fetches uncached settlement-date trade rates before returning them', async () => {
    mock.method(globalThis, 'fetch', async () => {
      return new Response(
        JSON.stringify({
          table: 'A',
          currency: 'dolar amerykanski',
          code: 'USD',
          rates: [
            {
              no: '003/A/NBP/2025',
              effectiveDate: '2025-01-03',
              mid: 4.1,
            },
          ],
        }),
        {
          headers: { 'content-type': 'application/json' },
          status: 200,
        },
      );
    });

    const rate = await getTradeSettlementFixingRate({
      currency: 'USD',
      date: '2025-01-02',
    });

    assert.equal(rate.date, '2025-01-03');
    assert.equal(rate.rate, 4.1);
  });

  void it('keeps the settlement-date trade rate setting disabled by default', async () => {
    const session = await createSession({ year: 2025 });

    assert.equal(session.useSettlementDateForTradeRates, false);
  });

  void it('persists the settlement-date trade rate setting on sessions', async () => {
    const session = await createSession({ year: 2025 });

    await updateSession({
      id: session.id,
      changes: { useSettlementDateForTradeRates: true },
    });

    const updated = await getSession({ id: session.id });
    assert.equal(updated?.useSettlementDateForTradeRates, true);
  });

  void it('prefetches trade rates through the estimated T+2 settlement window', async () => {
    const session = await createSession({ year: 2025 });
    const requestedUrls: string[] = [];
    mock.method(
      globalThis,
      'fetch',
      async (input: Parameters<typeof fetch>[0]) => {
        requestedUrls.push(
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url,
        );
        return new Response(
          JSON.stringify({
            table: 'A',
            currency: 'dolar amerykanski',
            code: 'USD',
            rates: [
              {
                no: '003/A/NBP/2025',
                effectiveDate: '2025-01-07',
                mid: 4.15,
              },
            ],
          }),
          {
            headers: { 'content-type': 'application/json' },
            status: 200,
          },
        );
      },
    );

    await db.trades.add({
      sessionId: session.id,
      symbol: 'AAPL',
      currency: 'USD',
      datetime: new Date(2025, 0, 3, 10, 0, 0),
      quantity: 1,
      price: 100,
      proceeds: 100,
      commission: 1,
      commissionCurrency: 'USD',
      type: 'sell',
    });

    await fetchRatesForSession({ sessionId: session.id });

    assert.equal(requestedUrls.length, 1);
    assert.match(
      requestedUrls[0],
      /\/USD\/2024-12-20\/2025-01-07\/\?format=json$/,
    );
  });
});

function useClock(now: Date) {
  mock.timers.reset();
  mock.timers.enable({ apis: ['Date'], now });
}

function endDateOf(url: string): string {
  const dates = url.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  return dates[dates.length - 1];
}

void describe('rates service near "today" (NBP publication)', () => {
  // Wed 2026-10-14, 10:00 Warsaw: before table A is published (~12:15).
  const TODAY = '2026-10-14';
  const BEFORE_PUBLICATION = new Date('2026-10-14T08:00:00Z');
  const AFTER_PUBLICATION = new Date('2026-10-14T11:00:00Z');

  afterEach(async () => {
    mock.timers.reset();
    mock.restoreAll();
    await clearRateCache();
    await db.sessions.clear();
    await db.trades.clear();
  });

  void it('derives today from the Europe/Warsaw calendar day', () => {
    // 23:30 UTC on Oct 13 is already Oct 14 in Warsaw (UTC+2).
    assert.equal(todayInWarsaw(new Date('2026-10-13T23:30:00Z')), TODAY);
    useClock(BEFORE_PUBLICATION);
    assert.equal(todayInWarsaw(), TODAY);
  });

  void it('fetchRatesForSession does not request ranges ending after today', async () => {
    useClock(BEFORE_PUBLICATION);
    const session = await createSession({ year: 2026 });
    const requests: string[] = [];
    mock.method(
      globalThis,
      'fetch',
      fakeNbp({
        today: TODAY,
        rates: { '2026-10-12': 4.0, '2026-10-13': 4.05 },
        requests,
      }),
    );
    await db.trades.add({
      sessionId: session.id,
      symbol: 'AAPL',
      currency: 'USD',
      datetime: new Date(2026, 9, 13, 10, 0, 0),
      quantity: 1,
      price: 100,
      proceeds: 100,
      commission: 1,
      commissionCurrency: 'USD',
      type: 'sell',
    });

    await fetchRatesForSession({ sessionId: session.id });

    assert.ok(requests.length > 0);
    for (const url of requests) {
      assert.ok(endDateOf(url) <= TODAY, `requested past today: ${url}`);
    }
    assert.equal((await db.nbpRates.get('USD:2026-10-13'))?.rate, 4.05);
  });

  void it('getFixingRate prefetch is clamped to today', async () => {
    useClock(BEFORE_PUBLICATION);
    const requests: string[] = [];
    mock.method(
      globalThis,
      'fetch',
      fakeNbp({ today: TODAY, rates: { '2026-10-12': 4.0 }, requests }),
    );

    const rate = await getFixingRate({ currency: 'USD', date: '2026-10-13' });

    assert.equal(rate.date, '2026-10-12');
    assert.equal(rate.rate, 4.0);
    assert.equal(requests.length, 1);
    // Clamped end; start moved back to keep the full 93-day window.
    assert.match(requests[0], /\/USD\/2026-07-14\/2026-10-14\/\?format=json$/);
  });

  void it('does not cache null for today before publication', async () => {
    useClock(BEFORE_PUBLICATION);
    mock.method(
      globalThis,
      'fetch',
      fakeNbp({
        today: TODAY,
        rates: { '2026-10-12': 4.0, '2026-10-13': 4.05 },
      }),
    );

    const result = await getCachedRates({
      currency: 'USD',
      startDate: '2026-10-10',
      endDate: TODAY,
    });

    assert.equal(result.get(TODAY), undefined);
    assert.equal(await db.nbpRates.get(`USD:${TODAY}`), undefined);
    // A past Sunday is a legitimate "no table" entry.
    const sunday = await db.nbpRates.get('USD:2026-10-11');
    assert.equal(sunday?.rate, null);
    assert.equal(sunday.fetchedAt, TODAY);
    assert.equal((await db.nbpRates.get('USD:2026-10-13'))?.fetchedAt, TODAY);
  });

  void it("picks up today's rate once it is published", async () => {
    useClock(BEFORE_PUBLICATION);
    const rates: Record<string, number> = {
      '2026-10-12': 4.0,
      '2026-10-13': 4.05,
    };
    mock.method(globalThis, 'fetch', fakeNbp({ today: TODAY, rates }));
    await getCachedRates({
      currency: 'USD',
      startDate: '2026-10-10',
      endDate: TODAY,
    });

    useClock(AFTER_PUBLICATION);
    rates[TODAY] = 4.1;

    const rate = await getFixingRate({ currency: 'USD', date: '2026-10-15' });

    assert.equal(rate.date, TODAY);
    assert.equal(rate.rate, 4.1);
  });

  void it('revalidates a legacy null record without fetchedAt', async () => {
    useClock(BEFORE_PUBLICATION);
    await db.nbpRates.put({
      id: 'USD:2026-10-13',
      currency: 'USD',
      date: '2026-10-13',
      rate: null,
      table: '',
    });
    await cacheRate({ currency: 'USD', date: '2026-10-12', rate: 4.0 });
    const requests: string[] = [];
    mock.method(
      globalThis,
      'fetch',
      fakeNbp({ today: TODAY, rates: { '2026-10-13': 4.05 }, requests }),
    );

    const rate = await getFixingRate({ currency: 'USD', date: TODAY });

    assert.equal(rate.date, '2026-10-13');
    assert.equal(rate.rate, 4.05);
    assert.ok(requests.length > 0);
  });

  void it('trusts a null record fetched on a later day (no refetch)', async () => {
    useClock(BEFORE_PUBLICATION);
    await db.nbpRates.put({
      id: 'USD:2026-10-13',
      currency: 'USD',
      date: '2026-10-13',
      rate: null,
      table: '',
      fetchedAt: TODAY,
    });
    await cacheRate({ currency: 'USD', date: '2026-10-12', rate: 4.0 });
    const fetchMock = mock.method(
      globalThis,
      'fetch',
      fakeNbp({ today: TODAY, rates: {} }),
    );

    const rate = await getFixingRate({ currency: 'USD', date: TODAY });

    assert.equal(rate.date, '2026-10-12');
    assert.equal(fetchMock.mock.callCount(), 0);
  });

  void it('never fetches or stores future dates', async () => {
    useClock(BEFORE_PUBLICATION);
    const fetchMock = mock.method(
      globalThis,
      'fetch',
      fakeNbp({ today: TODAY, rates: {} }),
    );

    const result = await getCachedRates({
      currency: 'USD',
      startDate: '2026-10-20',
      endDate: '2026-10-22',
    });

    assert.equal(fetchMock.mock.callCount(), 0);
    assert.deepEqual(
      [...result.entries()],
      [
        ['2026-10-20', undefined],
        ['2026-10-21', undefined],
        ['2026-10-22', undefined],
      ],
    );
    assert.equal(await db.nbpRates.count(), 0);
  });

  void it('throws NbpRateNotYetPublishedError instead of walking back past today', async () => {
    useClock(BEFORE_PUBLICATION);
    await cacheRate({ currency: 'USD', date: '2026-10-13', rate: 4.05 });
    mock.method(
      globalThis,
      'fetch',
      fakeNbp({ today: TODAY, rates: { '2026-10-13': 4.05 } }),
    );

    // T+2 from Wed 10-14 is Fri 10-16; the required table (Thu 10-15) is in
    // the future.
    await assert.rejects(
      getTradeSettlementFixingRate({ currency: 'USD', date: TODAY }),
      (e) =>
        e instanceof NbpRateNotYetPublishedError &&
        /not yet published/.test(e.message),
    );
    // Same for today's table before publication.
    await assert.rejects(
      getFixingRate({ currency: 'USD', date: '2026-10-15' }),
      NbpRateNotYetPublishedError,
    );
  });

  void it('fetchRatesForSession tolerates one failing currency', async () => {
    useClock(BEFORE_PUBLICATION);
    const session = await createSession({ year: 2026 });
    mock.method(
      globalThis,
      'fetch',
      fakeNbp({
        today: TODAY,
        rates: { '2026-10-12': 4.0 },
        failCurrencies: ['EUR'],
      }),
    );
    await db.trades.add({
      sessionId: session.id,
      symbol: 'AAPL',
      currency: 'USD',
      datetime: new Date(2026, 9, 13, 10, 0, 0),
      quantity: 1,
      price: 100,
      proceeds: 100,
      commission: 1,
      commissionCurrency: 'EUR',
      type: 'sell',
    });

    await fetchRatesForSession({ sessionId: session.id });

    assert.equal((await db.nbpRates.get('USD:2026-10-12'))?.rate, 4.0);
    assert.equal(await db.nbpRates.where('currency').equals('EUR').count(), 0);
  });
});
