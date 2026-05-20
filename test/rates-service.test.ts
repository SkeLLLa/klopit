import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

(globalThis as unknown as { $state: <T>(value: T) => T }).$state = (value) =>
  value;

const [
  { db },
  { clearRateCache, getFixingRate, getTradeSettlementFixingRate },
] = await Promise.all([
  import('../src/lib/db.js'),
  import('../src/lib/services/rates.js'),
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
});
