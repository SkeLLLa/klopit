import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, it, mock } from 'node:test';

(globalThis as unknown as { $state: <T>(value: T) => T }).$state = (value) =>
  value;

const [{ db }, { importFile }, { createSession }, { ibiDefinition }] =
  await Promise.all([
    import('../src/lib/db.js'),
    import('../src/lib/services/import.js'),
    import('../src/lib/services/session.js'),
    import('../src/core/parsers/ibi/index.js'),
  ]);

void describe('importFile account stamping', () => {
  afterEach(async () => {
    mock.restoreAll();
    await db.sessions.clear();
    await db.trades.clear();
    await db.carryInPositions.clear();
    await db.corporateActions.clear();
  });

  void it('stamps schwab:default on Schwab rows', async () => {
    const session = await createSession({ year: 2025 });
    const text = readFileSync(
      join(import.meta.dirname, 'fixtures', 'schwab', 'equity-awards.csv'),
      'utf-8',
    );
    const result = await importFile({
      sessionId: session.id,
      brokerId: 'schwab',
      fileName: 'equity-awards.csv',
      fileSize: text.length,
      file: new File([text], 'equity-awards.csv'),
    });
    const trades = await db.trades
      .where('sessionId')
      .equals(session.id)
      .toArray();
    assert.ok(result.tradeCount > 0);
    assert.ok(trades.every((t) => t.account === 'schwab:default'));
  });

  void it('stamps ibi:default on IBI rows, keeping existing accounts', async () => {
    const session = await createSession({ year: 2024 });
    const base = {
      symbol: 'ACME',
      currency: 'USD',
      datetime: new Date(2024, 6, 20),
      quantity: 1,
      price: 1,
      proceeds: 1,
      commission: 0,
      commissionCurrency: 'USD',
      type: 'sell' as const,
    };
    mock.method(ibiDefinition, 'parse', () =>
      Promise.resolve({
        broker: 'ibi',
        year: 2024,
        trades: [base, { ...base, account: 'ibi:custom' }],
        dividends: [],
        withholdingTaxes: [],
        corporateActions: [
          {
            type: 'stock-split' as const,
            symbol: 'ACME',
            datetime: new Date(2024, 1, 1),
            numerator: 2,
            denominator: 1,
          },
        ],
        carryInPositions: [{ symbol: 'ACME', quantity: 3, year: 2023 }],
        transactionFees: [],
        creditInterests: [],
        symbolToIsin: new Map(),
        warnings: [],
        skippedRows: [],
      }),
    );
    await importFile({
      sessionId: session.id,
      brokerId: 'ibi',
      fileName: 'x.pdf',
      fileSize: 1,
      file: new File([new Uint8Array(1)], 'x.pdf'),
    });
    const trades = await db.trades
      .where('sessionId')
      .equals(session.id)
      .toArray();
    assert.deepEqual(
      trades.map((t) => t.account),
      ['ibi:default', 'ibi:custom'],
    );
    const cas = await db.corporateActions
      .where('sessionId')
      .equals(session.id)
      .toArray();
    assert.equal(cas[0]?.account, 'ibi:default');
    const carry = await db.carryInPositions
      .where('sessionId')
      .equals(session.id)
      .toArray();
    assert.equal(carry[0]?.account, 'ibi:default');
  });
});
