import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

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

void describe('tax service', () => {
  afterEach(async () => {
    mock.restoreAll();
    loggerState.setLevel('error');
    await clearRateCache();
    await db.sessions.clear();
    await db.trades.clear();
    await db.tradeResults.clear();
    await db.taxSummaries.clear();
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
});
