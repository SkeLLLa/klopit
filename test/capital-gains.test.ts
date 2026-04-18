import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateCapitalGains } from '../src/core/tax/capital-gains.js';
import type {
  EnrichedCorporateAction,
  EnrichedTrade,
  TaxPeriod,
} from '../src/core/types.js';

const taxPeriod2024: TaxPeriod = {
  year: 2024,
  from: new Date(2024, 0, 1),
  to: new Date(2024, 11, 31),
};

function makeTrade(overrides: Partial<EnrichedTrade>): EnrichedTrade {
  return {
    symbol: 'AAPL',
    currency: 'USD',
    datetime: new Date(2024, 5, 15),
    quantity: 100,
    price: 150,
    proceeds: 0,
    commission: 1,
    commissionCurrency: 'USD',
    type: 'buy',
    exchangeRate: 4.0,
    commissionExchangeRate: 4.0,
    rateUnavailable: false,
    ...overrides,
  };
}

void describe('calculateCapitalGains', () => {
  void it('returns empty array for empty inputs', () => {
    const result = calculateCapitalGains({
      trades: [],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });
    assert.deepEqual(result, []);
  });

  void it('calculates simple buy and sell', () => {
    const buy = makeTrade({
      datetime: new Date(2024, 0, 15),
      quantity: 100,
      price: 150,
      proceeds: 0,
      type: 'buy',
      exchangeRate: 4.0,
      commissionExchangeRate: 4.0,
    });
    const sell = makeTrade({
      datetime: new Date(2024, 5, 15),
      quantity: 100,
      price: 160,
      proceeds: 16000,
      type: 'sell',
      exchangeRate: 4.1,
      commissionExchangeRate: 4.1,
    });

    const result = calculateCapitalGains({
      trades: [buy, sell],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    assert.equal(result.length, 2);

    // Buy result
    assert.equal(result[0].type, 'buy');
    assert.equal(result[0].proceedsPln, 0);
    assert.equal(result[0].taxPln, 0);

    // Sell result
    const sellResult = result[1];
    assert.equal(sellResult.type, 'sell');
    // proceedsPln = 16000 * 4.1 - 1 * 4.1 = 65600 - 4.1 = 65595.9
    assert.ok(
      Math.abs(sellResult.proceedsPln - 65595.9) < 0.01,
      `proceedsPln: ${String(sellResult.proceedsPln)}`,
    );
    // costPln = 100 * (150*4.0 + 1*4.0/100) = 100 * (600 + 0.04) = 60004
    assert.ok(
      Math.abs(sellResult.costPln - 60004) < 0.01,
      `costPln: ${String(sellResult.costPln)}`,
    );
    assert.ok(
      Math.abs(sellResult.gainLossPln - (65595.9 - 60004)) < 0.01,
      `gainLoss: ${String(sellResult.gainLossPln)}`,
    );
    // taxPln = gainLossPln * 0.19 (profitable sell)
    assert.ok(
      Math.abs(sellResult.taxPln - sellResult.gainLossPln * 0.19) < 0.001,
      `taxPln: ${String(sellResult.taxPln)}`,
    );
  });

  void it('applies FIFO ordering (first lot consumed first)', () => {
    const buy1 = makeTrade({
      datetime: new Date(2024, 0, 10),
      quantity: 50,
      price: 100,
      type: 'buy',
      commission: 0,
    });
    const buy2 = makeTrade({
      datetime: new Date(2024, 1, 10),
      quantity: 50,
      price: 200,
      type: 'buy',
      commission: 0,
    });
    const sell = makeTrade({
      datetime: new Date(2024, 5, 10),
      quantity: 50,
      price: 150,
      proceeds: 7500,
      type: 'sell',
      commission: 0,
    });

    const result = calculateCapitalGains({
      trades: [buy1, buy2, sell],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    const sellResult = result.find((r) => r.type === 'sell');
    assert.ok(sellResult, 'Expected a sell result');
    // FIFO: uses buy1 (price 100), costPln = 50 * 100 * 4.0 = 20000
    assert.ok(
      Math.abs(sellResult.costPln - 20000) < 0.01,
      `costPln: ${String(sellResult.costPln)}`,
    );
  });

  void it('handles partial lot consumption', () => {
    const buy = makeTrade({
      datetime: new Date(2024, 0, 10),
      quantity: 100,
      price: 100,
      type: 'buy',
      commission: 0,
    });
    const sell1 = makeTrade({
      datetime: new Date(2024, 3, 10),
      quantity: 60,
      price: 120,
      proceeds: 7200,
      type: 'sell',
      commission: 0,
    });
    const sell2 = makeTrade({
      datetime: new Date(2024, 6, 10),
      quantity: 40,
      price: 130,
      proceeds: 5200,
      type: 'sell',
      commission: 0,
    });

    const result = calculateCapitalGains({
      trades: [buy, sell1, sell2],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    const sells = result.filter((r) => r.type === 'sell');
    assert.equal(sells.length, 2);
    // Both use price 100, rate 4.0 → cost per share = 400 PLN
    assert.ok(Math.abs(sells[0].costPln - 24000) < 0.01); // 60 * 400
    assert.ok(Math.abs(sells[1].costPln - 16000) < 0.01); // 40 * 400
  });

  void it('applies stock split before trade on same datetime', () => {
    const buy = makeTrade({
      datetime: new Date(2024, 0, 10),
      quantity: 10,
      price: 1000,
      type: 'buy',
      commission: 0,
    });
    const split: EnrichedCorporateAction = {
      type: 'stock-split',
      symbol: 'AAPL',
      datetime: new Date(2024, 5, 10),
      numerator: 10,
      denominator: 1,
      cashExchangeRate: 0,
      cashRateUnavailable: false,
    };
    const sell = makeTrade({
      datetime: new Date(2024, 5, 10),
      quantity: 100,
      price: 110,
      proceeds: 11000,
      type: 'sell',
      commission: 0,
    });

    const result = calculateCapitalGains({
      trades: [buy, sell],
      corporateActions: [split],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    const sellResult = result.find((r) => r.type === 'sell');
    assert.ok(sellResult, 'Expected a sell result');
    // After 10:1 split: 100 shares, cost per share = 1000*4.0/10 = 400
    // costPln = 100 * 400 = 40000
    assert.ok(
      Math.abs(sellResult.costPln - 40000) < 0.01,
      `costPln: ${String(sellResult.costPln)}`,
    );
  });

  void it('filters results by tax period', () => {
    const buy = makeTrade({
      datetime: new Date(2023, 5, 10), // Before 2024
      quantity: 100,
      price: 100,
      type: 'buy',
      commission: 0,
    });
    const sell = makeTrade({
      datetime: new Date(2024, 5, 10), // In 2024
      quantity: 100,
      price: 120,
      proceeds: 12000,
      type: 'sell',
      commission: 0,
    });

    const result = calculateCapitalGains({
      trades: [buy, sell],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    // Buy is outside tax period — not in results
    // Sell is inside — in results
    assert.equal(result.length, 1);
    assert.equal(result[0].type, 'sell');
    // Cost still uses the 2023 buy (FIFO state maintained)
    assert.ok(
      Math.abs(result[0].costPln - 40000) < 0.01,
      `costPln: ${String(result[0].costPln)}`,
    );
  });

  void it('uses carry-in positions with zero cost', () => {
    const sell = makeTrade({
      datetime: new Date(2024, 5, 10),
      quantity: 50,
      price: 120,
      proceeds: 6000,
      type: 'sell',
      commission: 0,
    });

    const result = calculateCapitalGains({
      trades: [sell],
      corporateActions: [],
      carryInPositions: [{ symbol: 'AAPL', quantity: 100, year: 2024 }],
      taxPeriod: taxPeriod2024,
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].costPln, 0); // Carry-in has zero cost
  });

  void it('handles commission in different currency', () => {
    const buy = makeTrade({
      datetime: new Date(2024, 0, 10),
      quantity: 10,
      price: 100,
      type: 'buy',
      commission: 5,
      commissionCurrency: 'GBP',
      exchangeRate: 4.0,
      commissionExchangeRate: 5.2, // GBP rate
    });
    const sell = makeTrade({
      datetime: new Date(2024, 5, 10),
      quantity: 10,
      price: 120,
      proceeds: 1200,
      type: 'sell',
      commission: 0,
    });

    const result = calculateCapitalGains({
      trades: [buy, sell],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    const sellResult = result.find((r) => r.type === 'sell');
    assert.ok(sellResult, 'Expected a sell result');
    // Cost per share PLN = 100 * 4.0 = 400
    // Commission per share PLN = (5 * 5.2) / 10 = 2.6
    // Total cost = 10 * (400 + 2.6) = 4026
    assert.ok(
      Math.abs(sellResult.costPln - 4026) < 0.01,
      `costPln: ${String(sellResult.costPln)}`,
    );
  });

  void it('propagates rateUnavailable flag', () => {
    const buy = makeTrade({
      datetime: new Date(2024, 0, 10),
      quantity: 10,
      price: 100,
      type: 'buy',
      rateUnavailable: true,
      exchangeRate: 0,
    });

    const result = calculateCapitalGains({
      trades: [buy],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    assert.equal(result[0].rateUnavailable, true);
  });

  void it('throws when selling more shares than available', () => {
    const sell = makeTrade({
      datetime: new Date(2024, 5, 10),
      quantity: 100,
      price: 120,
      proceeds: 12000,
      type: 'sell',
    });

    assert.throws(
      () =>
        calculateCapitalGains({
          trades: [sell],
          corporateActions: [],
          carryInPositions: [],
          taxPeriod: taxPeriod2024,
        }),
      /No buy lots available/,
    );
  });

  void it('uses ISIN as lot key when available', () => {
    const buy = makeTrade({
      datetime: new Date(2024, 0, 10),
      symbol: 'AAPL',
      isin: 'US0378331005',
      quantity: 50,
      price: 100,
      type: 'buy',
      commission: 0,
    });
    const sell = makeTrade({
      datetime: new Date(2024, 5, 10),
      symbol: 'AAPL',
      isin: 'US0378331005',
      quantity: 50,
      price: 120,
      proceeds: 6000,
      type: 'sell',
      commission: 0,
    });

    const result = calculateCapitalGains({
      trades: [buy, sell],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    const sellResult = result.find((r) => r.type === 'sell');
    assert.ok(sellResult, 'Expected a sell result');
    assert.ok(
      Math.abs(sellResult.costPln - 20000) < 0.01,
      `costPln: ${String(sellResult.costPln)}`,
    );
  });

  void it('handles merger with cost basis transfer', () => {
    const buy = makeTrade({
      symbol: 'MAG',
      isin: 'CA55903Q1046',
      datetime: new Date(2024, 0, 10),
      quantity: 30,
      price: 20,
      type: 'buy',
      commission: 0,
    });
    const merger: EnrichedCorporateAction = {
      type: 'merger',
      symbol: 'MAG',
      isin: 'CA55903Q1046',
      datetime: new Date(2024, 8, 8),
      numerator: 0,
      denominator: 0,
      targetSymbol: 'PAAS',
      targetIsin: 'CA6979001089',
      conversionRatio: 0.58844257,
      cashPerShare: 0,
      cashCurrency: 'USD',
      cashExchangeRate: 0,
      cashRateUnavailable: false,
    };
    const sell = makeTrade({
      symbol: 'PAAS',
      isin: 'CA6979001089',
      datetime: new Date(2024, 10, 10),
      quantity: 17,
      price: 30,
      proceeds: 510,
      type: 'sell',
      commission: 0,
    });

    const result = calculateCapitalGains({
      trades: [buy, sell],
      corporateActions: [merger],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    const sellResult = result.find(
      (r) => r.type === 'sell' && r.symbol === 'PAAS',
    );
    assert.ok(sellResult, 'Should have a sell result for PAAS');
    // Cost basis was transferred from MAG
    assert.ok(sellResult.costPln > 0, 'Cost should be > 0 (transferred)');
  });

  void it('taxPln is zero for loss sell', () => {
    const buy = makeTrade({
      datetime: new Date(2024, 0, 10),
      quantity: 100,
      price: 200,
      type: 'buy',
      commission: 0,
    });
    const sell = makeTrade({
      datetime: new Date(2024, 5, 10),
      quantity: 100,
      price: 100,
      proceeds: 10000,
      type: 'sell',
      commission: 0,
    });

    const result = calculateCapitalGains({
      trades: [buy, sell],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    const sellResult = result.find((r) => r.type === 'sell');
    assert.ok(sellResult, 'Expected a sell result');
    assert.ok(sellResult.gainLossPln < 0, 'Should be a loss');
    assert.equal(sellResult.taxPln, 0, 'taxPln should be 0 for a loss');
  });

  void it('treats bond trades same as stock trades', () => {
    // Bonds use same FIFO — just buy/sell with different prices
    const buy = makeTrade({
      symbol: 'BOND123',
      datetime: new Date(2024, 0, 10),
      quantity: 5000,
      price: 0.6,
      type: 'buy',
      commission: 10,
    });
    const sell = makeTrade({
      symbol: 'BOND123',
      datetime: new Date(2024, 5, 10),
      quantity: 5000,
      price: 0.65,
      proceeds: 3250,
      type: 'sell',
      commission: 10,
    });

    const result = calculateCapitalGains({
      trades: [buy, sell],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    const sellResult = result.find((r) => r.type === 'sell');
    assert.ok(sellResult, 'Expected a sell result');
    assert.ok(sellResult.gainLossPln !== 0, 'Should have non-zero gain');
  });

  /**
   * FIFO across ESPP
   * grants is semantically wrong — each grant is tracked independently at
   * the broker and can be bought/sold in any interleaving relative to
   * other grants. With `lotId` set per order, the FIFO engine isolates
   * each grant's buy/sell into its own queue, so per-transaction P&L in
   * the data table and dashboard reflects each order's own cost basis.
   */
  void it('partitions FIFO by lotId so ESPP grants do not commingle (same-day sells)', () => {
    const buy71 = makeTrade({
      datetime: new Date(2025, 7, 31),
      symbol: 'TSLA',
      quantity: 71,
      price: 119.92,
      proceeds: 119.92 * 71,
      type: 'buy',
      commission: 0,
      exchangeRate: 4.0,
      commissionExchangeRate: 4.0,
      lotId: '1000001',
    });
    const buy146 = makeTrade({
      datetime: new Date(2026, 1, 28),
      symbol: 'TSLA',
      quantity: 146,
      price: 59.89,
      proceeds: 59.89 * 146,
      type: 'buy',
      commission: 0,
      exchangeRate: 4.0,
      commissionExchangeRate: 4.0,
      lotId: '2000002',
    });
    // Both sells share the exact same datetime. With lotId partitioning,
    // each one consumes only its own grant's buy lot regardless of
    // input array order.
    const sell146 = makeTrade({
      datetime: new Date(2026, 2, 30),
      symbol: 'TSLA',
      quantity: 146,
      price: 87.21,
      proceeds: 146 * 87.21,
      type: 'sell',
      commission: 17.11,
      exchangeRate: 4.0,
      commissionExchangeRate: 4.0,
      lotId: '2000002',
    });
    const sell71 = makeTrade({
      datetime: new Date(2026, 2, 30),
      symbol: 'TSLA',
      quantity: 71,
      price: 87.21,
      proceeds: 71 * 87.21,
      type: 'sell',
      commission: 10.19,
      exchangeRate: 4.0,
      commissionExchangeRate: 4.0,
      lotId: '1000001',
    });

    const result = calculateCapitalGains({
      trades: [buy71, buy146, sell146, sell71],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: {
        year: 2026,
        from: new Date(2026, 0, 1),
        to: new Date(2026, 11, 31),
      },
    });

    const sells = result.filter((r) => r.type === 'sell');
    assert.equal(sells.length, 2);
    const s71 = sells.find((s) => s.quantity === 71);
    const s146 = sells.find((s) => s.quantity === 146);
    assert.ok(s71 && s146);

    // 71-share sell consumes the 71-share grant (cost 119.92 > proceeds 87.21) → loss.
    assert.ok(
      s71.gainLossPln < 0,
      `71-share sell should be a loss; got ${String(s71.gainLossPln)}`,
    );
    // 146-share sell consumes the 146-share grant (cost 59.89 < proceeds 87.21) → gain.
    assert.ok(
      s146.gainLossPln > 0,
      `146-share sell should be a gain; got ${String(s146.gainLossPln)}`,
    );
  });

  /**
   * Covers the user-described interleaved case: one grant is bought early
   * and sold late, while a second grant is bought and sold in between. A
   * global FIFO would consume the first grant's lot for the interleaved
   * sell; with `lotId` partitioning, each sell hits its own grant.
   */
  void it('partitions FIFO by lotId across interleaved grant timelines', () => {
    const buyA = makeTrade({
      datetime: new Date(2024, 7, 31), // Aug 2024
      symbol: 'TSLA',
      quantity: 50,
      price: 100,
      proceeds: 5000,
      type: 'buy',
      commission: 0,
      exchangeRate: 4.0,
      commissionExchangeRate: 4.0,
      lotId: 'A',
    });
    const buyB = makeTrade({
      datetime: new Date(2024, 10, 15), // Nov 2024
      symbol: 'TSLA',
      quantity: 30,
      price: 200,
      proceeds: 6000,
      type: 'buy',
      commission: 0,
      exchangeRate: 4.0,
      commissionExchangeRate: 4.0,
      lotId: 'B',
    });
    // B is bought and sold before A is sold.
    const sellB = makeTrade({
      datetime: new Date(2024, 11, 5), // Dec 2024
      symbol: 'TSLA',
      quantity: 30,
      price: 250,
      proceeds: 7500,
      type: 'sell',
      commission: 0,
      exchangeRate: 4.0,
      commissionExchangeRate: 4.0,
      lotId: 'B',
    });
    const sellA = makeTrade({
      datetime: new Date(2024, 11, 20), // Dec 2024
      symbol: 'TSLA',
      quantity: 50,
      price: 80, // sold at a loss
      proceeds: 4000,
      type: 'sell',
      commission: 0,
      exchangeRate: 4.0,
      commissionExchangeRate: 4.0,
      lotId: 'A',
    });

    const result = calculateCapitalGains({
      trades: [buyA, buyB, sellB, sellA],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    const sells = result.filter((r) => r.type === 'sell');
    const rB = sells.find((s) => s.quantity === 30);
    const rA = sells.find((s) => s.quantity === 50);
    assert.ok(rA && rB);

    // B: 30 @ 250 - 30 @ 200 = +50/share * 4.0 = +1500 × 30/30 → +6000 PLN
    // Cost B: 30 × 200 × 4.0 = 24000 PLN; Proceeds B: 30 × 250 × 4.0 = 30000 PLN; Gain: 6000 PLN.
    assert.ok(
      Math.abs(rB.costPln - 24000) < 0.01,
      `B cost should come from grant B only (price 200); got ${String(rB.costPln)}`,
    );
    assert.ok(
      Math.abs(rB.gainLossPln - 6000) < 0.01,
      `B gain: ${String(rB.gainLossPln)}`,
    );

    // A: Cost 50 × 100 × 4.0 = 20000 PLN; Proceeds 50 × 80 × 4.0 = 16000 PLN; Loss: -4000 PLN.
    assert.ok(
      Math.abs(rA.costPln - 20000) < 0.01,
      `A cost should come from grant A only (price 100); got ${String(rA.costPln)}`,
    );
    assert.ok(
      Math.abs(rA.gainLossPln - -4000) < 0.01,
      `A loss: ${String(rA.gainLossPln)}`,
    );
  });
});
