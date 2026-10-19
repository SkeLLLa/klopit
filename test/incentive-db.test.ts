import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

(globalThis as unknown as { $state: <T>(value: T) => T }).$state = (value) =>
  value;

const [{ db }, { setIncentiveRegimeForSymbol }, { createSession }] =
  await Promise.all([
    import('../src/lib/db.js'),
    import('../src/lib/services/incentive.js'),
    import('../src/lib/services/session.js'),
  ]);

function buy(sessionId: string, overrides: Record<string, unknown> = {}) {
  return {
    sessionId,
    symbol: 'ACME',
    currency: 'USD',
    datetime: new Date(2024, 0, 15),
    quantity: 10,
    price: 0,
    proceeds: 0,
    commission: 0,
    commissionCurrency: 'USD',
    type: 'buy' as const,
    source: 'rsu' as const,
    ...overrides,
  };
}

void describe('setIncentiveRegimeForSymbol', () => {
  void it('only touches incentive buys of that symbol in that session', async () => {
    const a = await createSession({ year: 2024 });
    const b = await createSession({ year: 2024 });
    await db.trades.bulkAdd([
      buy(a.id, { incentive: { fmvPerShare: 5 } }),
      buy(a.id, { source: 'espp' }),
      buy(a.id, { source: undefined }),
      buy(a.id, { symbol: 'OTHER' }),
      buy(b.id),
    ]);

    await setIncentiveRegimeForSymbol({
      sessionId: a.id,
      symbol: 'ACME',
      regime: 'qualifying',
    });

    const rows = await db.trades.toArray();
    const inA = rows.filter((r) => r.sessionId === a.id);
    assert.deepEqual(inA[0].incentive, {
      fmvPerShare: 5,
      regime: 'qualifying',
    });
    assert.deepEqual(inA[1].incentive, { regime: 'qualifying' });
    assert.equal(inA[2].incentive, undefined);
    assert.equal(inA[3].incentive, undefined);
    assert.equal(rows.find((r) => r.sessionId === b.id)?.incentive, undefined);

    await setIncentiveRegimeForSymbol({
      sessionId: a.id,
      symbol: 'ACME',
      regime: undefined,
    });
    const cleared = (await db.trades.toArray()).filter(
      (r) => r.sessionId === a.id,
    );
    assert.deepEqual(cleared[0].incentive, { fmvPerShare: 5 });
    assert.equal(cleared[1].incentive, undefined);
  });
});
