import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

(globalThis as unknown as { $state: <T>(value: T) => T }).$state = (value) =>
  value;

const [
  { db },
  {
    clearRateCache,
    fetchRatesForSession,
    getFixingRate,
    getTradeSettlementFixingRate,
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
