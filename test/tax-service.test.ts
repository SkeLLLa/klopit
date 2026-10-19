import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import { fakeNbp } from './helpers/fake-nbp.js';

(globalThis as unknown as { $state: <T>(value: T) => T }).$state = (value) =>
  value;

const [
  { db },
  { calculateSessionTaxes },
  { clearRateCache },
  { createSession, updateSession },
  { loggerState },
] = await Promise.all([
  import('../src/lib/db.js'),
  import('../src/lib/services/tax.js'),
  import('../src/lib/services/rates.js'),
  import('../src/lib/services/session.js'),
  import('../src/lib/state/logger.svelte.js'),
]);

async function seedCarryInSession(args: {
  carryIn: Record<string, unknown>;
}): Promise<string> {
  const session = await createSession({ year: 2024 });
  // PLN sell so the only FX lookup is the carry-in cost.
  await db.trades.add({
    sessionId: session.id,
    symbol: 'AAPL',
    currency: 'PLN',
    datetime: new Date(2024, 2, 1, 10, 0, 0),
    quantity: 10,
    price: 800,
    proceeds: 8000,
    commission: 0,
    commissionCurrency: 'PLN',
    type: 'sell',
  });
  await db.carryInPositions.add({
    sessionId: session.id,
    symbol: 'AAPL',
    quantity: 10,
    year: 2023,
    ...args.carryIn,
  });
  return session.id;
}

void describe('tax service', () => {
  afterEach(async () => {
    mock.restoreAll();
    loggerState.setLevel('error');
    await clearRateCache();
    await db.sessions.clear();
    await db.trades.clear();
    await db.tradeResults.clear();
    await db.taxSummaries.clear();
    await db.carryInPositions.clear();
  });

  void it('logs settlement-date rate misses with the settlement reference date', async () => {
    const session = await createSession({ year: 2025 });
    await updateSession({
      id: session.id,
      changes: { useSettlementDateForTradeRates: true },
    });
    await db.trades.add({
      sessionId: session.id,
      symbol: 'AAPL',
      currency: 'USD',
      datetime: new Date(2025, 0, 3, 10, 0, 0),
      quantity: 1,
      price: 100,
      proceeds: 0,
      commission: 0,
      commissionCurrency: 'PLN',
      type: 'buy',
    });
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
    const warnings: unknown[][] = [];
    mock.method(console, 'warn', (...args: unknown[]) => {
      warnings.push(args);
    });
    loggerState.setLevel('warn');

    await calculateSessionTaxes({ sessionId: session.id });

    const taxRateMissWarnings = warnings.filter(
      (args) =>
        args[0] === '[tax]' &&
        typeof args[1] === 'string' &&
        args[1].startsWith('tryGetFixingRate(trade):'),
    );
    assert.ok(
      taxRateMissWarnings.some(
        (args) =>
          typeof args[1] === 'string' && args[1].includes('before 2025-01-07'),
      ),
      `expected settlement reference date in tax warning, got ${JSON.stringify(
        taxRateMissWarnings.map((args) => args.map(String)),
      )}`,
    );
  });

  void it('converts a USD carry-in cost at the NBP rate from the day before acquisition', async () => {
    const sessionId = await seedCarryInSession({
      carryIn: {
        acquisitionDate: new Date(2023, 4, 10),
        costBasis: 1500,
        currency: 'USD',
        costBasisSource: 'user',
      },
    });
    mock.method(globalThis, 'fetch', async () => {
      return new Response(
        JSON.stringify({
          table: 'A',
          currency: 'dolar amerykanski',
          code: 'USD',
          rates: [
            { no: '089/A/NBP/2023', effectiveDate: '2023-05-09', mid: 4.2 },
          ],
        }),
        { headers: { 'content-type': 'application/json' }, status: 200 },
      );
    });

    await calculateSessionTaxes({ sessionId });

    const results = await db.tradeResults
      .where('sessionId')
      .equals(sessionId)
      .toArray();
    assert.equal(results.length, 1);
    assert.ok(Math.abs(results[0].costPln - 1500 * 4.2) < 1e-9);
    assert.equal(results[0].costBasisMissing, undefined);
  });

  void it('uses costBasisPln without an FX lookup', async () => {
    const sessionId = await seedCarryInSession({
      carryIn: {
        acquisitionDate: new Date(2023, 4, 10),
        costBasis: 1500,
        currency: 'USD',
        costBasisPln: 6000,
        costBasisSource: 'user',
      },
    });
    const fetchMock = mock.method(globalThis, 'fetch', async () => {
      throw new Error('fetch must not be called');
    });

    await calculateSessionTaxes({ sessionId });

    assert.equal(fetchMock.mock.callCount(), 0);
    const results = await db.tradeResults
      .where('sessionId')
      .equals(sessionId)
      .toArray();
    assert.equal(results[0].costPln, 6000);
  });

  void it('flags a sell from a carry-in without cost', async () => {
    const sessionId = await seedCarryInSession({ carryIn: {} });
    await calculateSessionTaxes({ sessionId });
    const results = await db.tradeResults
      .where('sessionId')
      .equals(sessionId)
      .toArray();
    assert.equal(results[0].costPln, 0);
    assert.equal(results[0].costBasisMissing, true);
    const summary = await db.taxSummaries.get(sessionId);
    assert.equal(summary?.missingCostCount, 1);
  });
});

void describe('tax service near "today" (NBP publication)', () => {
  // Wed 2026-10-14, 10:00 Warsaw: today's NBP table is not published yet.
  const TODAY = '2026-10-14';

  afterEach(async () => {
    mock.timers.reset();
    mock.restoreAll();
    loggerState.setLevel('error');
    await clearRateCache();
    await db.sessions.clear();
    await db.trades.clear();
    await db.tradeResults.clear();
    await db.taxSummaries.clear();
  });

  void it('calculateSessionTaxes completes when NBP returns 400 for future dates', async () => {
    mock.timers.enable({
      apis: ['Date'],
      now: new Date('2026-10-14T08:00:00Z'),
    });
    const session = await createSession({ year: 2026 });
    await updateSession({
      id: session.id,
      changes: { useSettlementDateForTradeRates: true },
    });
    const trade = {
      sessionId: session.id,
      symbol: 'AAPL',
      currency: 'USD',
      quantity: 1,
      price: 100,
      commission: 0,
      commissionCurrency: 'USD',
    };
    // Buy: T+2 = Mon 10-05 -> rate of Fri 10-02 (published).
    await db.trades.add({
      ...trade,
      datetime: new Date(2026, 9, 1, 10, 0, 0),
      proceeds: 0,
      type: 'buy',
    });
    // Sell yesterday: T+2 = Thu 10-15 -> needs today's (unpublished) table.
    await db.trades.add({
      ...trade,
      datetime: new Date(2026, 9, 13, 10, 0, 0),
      proceeds: 120,
      type: 'sell',
    });
    const requests: string[] = [];
    mock.method(
      globalThis,
      'fetch',
      fakeNbp({
        today: TODAY,
        rates: { '2026-10-02': 3.9, '2026-10-12': 4.0, '2026-10-13': 4.05 },
        requests,
      }),
    );

    await calculateSessionTaxes({ sessionId: session.id });

    for (const url of requests) {
      const dates = url.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
      assert.ok(dates[dates.length - 1] <= TODAY, `past today: ${url}`);
    }
    const rows = await db.tradeResults
      .where('sessionId')
      .equals(session.id)
      .toArray();
    const buy = rows.find((r) => r.type === 'buy');
    const sell = rows.find((r) => r.type === 'sell');
    assert.equal(buy?.rateUnavailable, false);
    assert.equal(buy.exchangeRate, 3.9);
    // Not walked back to the 10-13 rate: flagged instead.
    assert.equal(sell?.rateUnavailable, true);
    assert.equal(sell.exchangeRate, 0);
    const summary = await db.taxSummaries.get(session.id);
    assert.equal(summary?.missingRateCount, 1);
  });

  void it('marks the summary complete when every rate is available', async () => {
    mock.timers.enable({
      apis: ['Date'],
      now: new Date('2026-10-14T08:00:00Z'),
    });
    const session = await createSession({ year: 2026 });
    await db.trades.add({
      sessionId: session.id,
      symbol: 'AAPL',
      currency: 'USD',
      datetime: new Date(2026, 9, 13, 10, 0, 0),
      quantity: 1,
      price: 100,
      proceeds: 0,
      commission: 0,
      commissionCurrency: 'USD',
      type: 'buy',
    });
    mock.method(
      globalThis,
      'fetch',
      fakeNbp({ today: TODAY, rates: { '2026-10-12': 4.0 } }),
    );

    await calculateSessionTaxes({ sessionId: session.id });

    const summary = await db.taxSummaries.get(session.id);
    assert.equal(summary?.missingRateCount, 0);
  });
});
