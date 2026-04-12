import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyMerger,
  applyStockSplit,
  type FifoLot,
} from '../src/core/tax/corporate-actions.js';

function totalCost(lots: FifoLot[]): number {
  return lots.reduce(
    (sum, lot) =>
      sum + lot.quantity * (lot.costPerSharePln + lot.commissionPerSharePln),
    0,
  );
}

void describe('applyStockSplit', () => {
  void it('applies forward split 10:1', () => {
    const lots: FifoLot[] = [
      { quantity: 10, costPerSharePln: 100, commissionPerSharePln: 1 },
    ];
    const result = applyStockSplit({ lots, numerator: 10, denominator: 1 });
    assert.equal(result.length, 1);
    assert.equal(result[0].quantity, 100);
    assert.equal(result[0].costPerSharePln, 10);
    assert.equal(result[0].commissionPerSharePln, 0.1);
  });

  void it('applies reverse split 1:3', () => {
    const lots: FifoLot[] = [
      { quantity: 30, costPerSharePln: 10, commissionPerSharePln: 0.3 },
    ];
    const result = applyStockSplit({ lots, numerator: 1, denominator: 3 });
    assert.equal(result.length, 1);
    assert.equal(result[0].quantity, 10);
    assert.equal(result[0].costPerSharePln, 30);
    // Use tolerance for floating point
    assert.ok(
      Math.abs(result[0].commissionPerSharePln - 0.9) < 1e-10,
      `Expected ~0.9, got ${String(result[0].commissionPerSharePln)}`,
    );
  });

  void it('preserves total cost basis after split', () => {
    const lots: FifoLot[] = [
      { quantity: 50, costPerSharePln: 40, commissionPerSharePln: 2 },
    ];
    const costBefore = totalCost(lots);
    const result = applyStockSplit({ lots, numerator: 4, denominator: 1 });
    const costAfter = totalCost(result);
    assert.ok(
      Math.abs(costAfter - costBefore) < 1e-10,
      `Cost changed: ${String(costBefore)} → ${String(costAfter)}`,
    );
  });

  void it('splits multiple lots independently', () => {
    const lots: FifoLot[] = [
      { quantity: 10, costPerSharePln: 100, commissionPerSharePln: 1 },
      { quantity: 20, costPerSharePln: 200, commissionPerSharePln: 2 },
      { quantity: 5, costPerSharePln: 50, commissionPerSharePln: 0.5 },
    ];
    const result = applyStockSplit({ lots, numerator: 2, denominator: 1 });
    assert.equal(result.length, 3);
    assert.equal(result[0].quantity, 20);
    assert.equal(result[1].quantity, 40);
    assert.equal(result[2].quantity, 10);
  });

  void it('returns empty array for empty lots', () => {
    const result = applyStockSplit({
      lots: [],
      numerator: 10,
      denominator: 1,
    });
    assert.deepEqual(result, []);
  });

  void it('returns identical lots for factor = 1', () => {
    const lots: FifoLot[] = [
      { quantity: 10, costPerSharePln: 100, commissionPerSharePln: 1 },
    ];
    const result = applyStockSplit({ lots, numerator: 1, denominator: 1 });
    assert.deepEqual(result, lots);
  });

  void it('does not mutate input lots', () => {
    const lots: FifoLot[] = [
      { quantity: 10, costPerSharePln: 100, commissionPerSharePln: 1 },
    ];
    applyStockSplit({ lots, numerator: 2, denominator: 1 });
    assert.equal(lots[0].quantity, 10);
    assert.equal(lots[0].costPerSharePln, 100);
  });

  void it('throws for denominator = 0', () => {
    assert.throws(
      () => applyStockSplit({ lots: [], numerator: 10, denominator: 0 }),
      { message: 'Stock split denominator cannot be zero' },
    );
  });

  void it('throws for factor = 0 (numerator = 0)', () => {
    assert.throws(
      () => applyStockSplit({ lots: [], numerator: 0, denominator: 1 }),
      { message: 'Stock split factor cannot be zero' },
    );
  });
});

void describe('applyMerger', () => {
  void it('allocates cost proportionally with newSharesValue', () => {
    // 30 shares, cost = 30 * (100 + 2) = 3060 PLN
    const lots: FifoLot[] = [
      { quantity: 30, costPerSharePln: 100, commissionPerSharePln: 2 },
    ];
    const result = applyMerger({
      lots,
      conversionRatio: 0.58844257,
      cashPerShare: 4.528,
      cashCurrency: 'USD',
      cashExchangeRate: 4.0,
      newSharesValue: 628, // FMV of new shares in USD
    });

    // Cash proceeds = 30 * 4.528 = 135.84
    assert.ok(
      Math.abs(result.cashProceeds - 135.84) < 1e-10,
      `Cash proceeds: ${String(result.cashProceeds)}`,
    );
    assert.equal(result.cashCurrency, 'USD');

    // Total consideration = 135.84 + 628 = 763.84
    // Cash fraction = 135.84 / 763.84 ≈ 0.17785
    // Cash cost = 3060 * 0.17785 ≈ 544.23
    // Remaining cost = 3060 - 544.23 ≈ 2515.77
    const cashFraction = 135.84 / (135.84 + 628);
    const expectedCashCost = 3060 * cashFraction;
    assert.ok(
      Math.abs(result.cashCostPln - expectedCashCost) < 0.01,
      `Cash cost: ${String(result.cashCostPln)} vs expected ${String(expectedCashCost)}`,
    );

    // New qty = 30 * 0.58844257 = 17.6532771
    assert.equal(result.newLots.length, 1);
    assert.ok(
      Math.abs(result.newLots[0].quantity - 17.6532771) < 1e-6,
      `New qty: ${String(result.newLots[0].quantity)}`,
    );
  });

  void it('falls back to zero cost when newSharesValue is missing', () => {
    // Without newSharesValue, all cash is treated as income (conservative)
    const lots: FifoLot[] = [
      { quantity: 100, costPerSharePln: 50, commissionPerSharePln: 0 },
    ];
    const result = applyMerger({
      lots,
      conversionRatio: 0.5,
      cashPerShare: 10,
      cashCurrency: 'USD',
      cashExchangeRate: 4.0,
    });

    // Cash proceeds = 1000, no newSharesValue → cashFraction = 1, costPln = 5000
    assert.equal(result.cashCostPln, 5000);
    assert.equal(result.cashProceeds, 1000);
  });

  void it('applies stock-only merger (no cash)', () => {
    const lots: FifoLot[] = [
      { quantity: 100, costPerSharePln: 50, commissionPerSharePln: 1 },
    ];
    const result = applyMerger({
      lots,
      conversionRatio: 0.5,
      cashPerShare: 0,
      cashCurrency: 'USD',
      cashExchangeRate: 4.0,
    });

    assert.equal(result.cashProceeds, 0);
    assert.equal(result.newLots.length, 1);
    assert.equal(result.newLots[0].quantity, 50);
    // Full cost transfers: 100 * (50 + 1) = 5100 → 5100/50 = 102 per share
    assert.equal(result.newLots[0].costPerSharePln, 102);
  });

  void it('applies cash-only buyout (no new shares)', () => {
    const lots: FifoLot[] = [
      { quantity: 100, costPerSharePln: 50, commissionPerSharePln: 1 },
    ];
    const result = applyMerger({
      lots,
      conversionRatio: 0,
      cashPerShare: 75,
      cashCurrency: 'USD',
      cashExchangeRate: 4.0,
    });

    assert.equal(result.cashProceeds, 7500);
    // Cash-only buyout: all cost allocated to cash
    assert.equal(result.cashCostPln, 5100);
    assert.deepEqual(result.newLots, []);
  });

  void it('preserves cost basis (cash + new shares = original)', () => {
    const lots: FifoLot[] = [
      { quantity: 100, costPerSharePln: 50, commissionPerSharePln: 0 },
    ];
    const result = applyMerger({
      lots,
      conversionRatio: 0.8,
      cashPerShare: 5,
      cashCurrency: 'USD',
      cashExchangeRate: 4.0,
      newSharesValue: 2000, // FMV of new shares
    });

    const originalCost = totalCost(lots);
    const newSharesCost = totalCost(result.newLots);
    assert.ok(
      Math.abs(result.cashCostPln + newSharesCost - originalCost) < 1e-10,
      `Cost not preserved: ${String(result.cashCostPln)} + ${String(newSharesCost)} ≠ ${String(originalCost)}`,
    );
  });

  void it('returns empty result for empty lots', () => {
    const result = applyMerger({
      lots: [],
      conversionRatio: 0.5,
      cashPerShare: 10,
      cashCurrency: 'USD',
      cashExchangeRate: 4.0,
    });

    assert.deepEqual(result.newLots, []);
    assert.equal(result.cashProceeds, 0);
  });

  void it('handles multiple lots merged into single new lot', () => {
    const lots: FifoLot[] = [
      { quantity: 20, costPerSharePln: 100, commissionPerSharePln: 1 },
      { quantity: 30, costPerSharePln: 80, commissionPerSharePln: 0.5 },
    ];
    const result = applyMerger({
      lots,
      conversionRatio: 0.5,
      cashPerShare: 0,
      cashCurrency: 'USD',
      cashExchangeRate: 4.0,
    });

    // Total old qty = 50, total cost = 20*101 + 30*80.5 = 2020 + 2415 = 4435
    // New qty = 25, cost per share = 4435/25 = 177.4
    assert.equal(result.newLots.length, 1);
    assert.equal(result.newLots[0].quantity, 25);
    assert.ok(
      Math.abs(result.newLots[0].costPerSharePln - 177.4) < 1e-10,
      `Cost per share: ${String(result.newLots[0].costPerSharePln)}`,
    );
  });
});
