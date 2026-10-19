import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

(globalThis as unknown as { $state: <T>(value: T) => T }).$state = (value) =>
  value;

const [
  { db },
  { addCarryInPosition, updateCarryInPosition },
  { createSession },
  { CarryInValidationError },
] = await Promise.all([
  import('../src/lib/db.js'),
  import('../src/lib/services/data.js'),
  import('../src/lib/services/session.js'),
  import('../src/lib/services/carry-in.js'),
]);

async function seed(): Promise<number> {
  const session = await createSession({ year: 2024 });
  return addCarryInPosition({
    sessionId: session.id,
    position: {
      symbol: 'aapl',
      quantity: 10,
      year: 2023,
      acquisitionDate: new Date(2023, 4, 10),
      costBasis: 1500,
      currency: 'USD',
      costBasisPln: 6000,
    },
  });
}

void describe('updateCarryInPosition merge semantics', () => {
  afterEach(async () => {
    await db.sessions.clear();
    await db.carryInPositions.clear();
  });

  void it('keeps the PLN override when the cost is untouched', async () => {
    const id = await seed();
    await updateCarryInPosition({
      id,
      changes: { quantity: 12, costBasis: 1500, currency: 'USD' },
    });
    const row = await db.carryInPositions.get(id);
    assert.ok(row);
    assert.equal(row.quantity, 12);
    assert.equal(row.costBasisPln, 6000);
    assert.equal(row.symbol, 'AAPL');
  });

  void it('drops the PLN override when the cost or currency changes', async () => {
    const id = await seed();
    await updateCarryInPosition({ id, changes: { costBasis: 1600 } });
    assert.equal((await db.carryInPositions.get(id))?.costBasisPln, undefined);

    const other = await seed();
    await updateCarryInPosition({ id: other, changes: { currency: 'EUR' } });
    const row = await db.carryInPositions.get(other);
    assert.ok(row);
    assert.equal(row.costBasisPln, undefined);
    assert.equal(row.currency, 'EUR');
  });

  void it('keeps an explicitly changed PLN override', async () => {
    const id = await seed();
    await updateCarryInPosition({
      id,
      changes: { costBasis: 1600, costBasisPln: 6400 },
    });
    assert.equal((await db.carryInPositions.get(id))?.costBasisPln, 6400);
  });

  void it('validates the merged row and leaves it unchanged on error', async () => {
    const id = await seed();
    await assert.rejects(
      updateCarryInPosition({ id, changes: { year: 2024 } }),
      CarryInValidationError,
    );
    assert.equal((await db.carryInPositions.get(id))?.year, 2023);
  });
});
