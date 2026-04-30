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

  void it('includes sell trades on the tax-period end date after midnight', () => {
    const buy = makeTrade({
      datetime: new Date(2025, 11, 30, 10, 0, 0),
      quantity: 10,
      price: 100,
      type: 'buy',
      commission: 0,
    });
    const sell = makeTrade({
      datetime: new Date(2025, 11, 31, 15, 30, 0),
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
      taxPeriod: {
        year: 2025,
        from: new Date(2025, 0, 1),
        to: new Date(2025, 11, 31),
      },
    });

    const sells = result.filter((row) => row.type === 'sell');
    assert.equal(sells.length, 1);
    assert.equal(sells[0].datetime.getDate(), 31);
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

void describe('calculateCapitalGains — cross-year FIFO', () => {
  /**
   * Buy in tax year N-1 (2023), sell in tax year N (2024).
   * The buy trade's datetime falls before taxPeriod.from, so it is excluded
   * from results but must still seed the FIFO queue with the correct PLN cost
   * basis. The sell result must reflect that prior-year cost.
   *
   * Buy:  100 shares, price 150 USD, rate 4.0 PLN/USD, no commission → costPln = 60 000
   * Sell: 100 shares, price 180 USD, rate 4.2 PLN/USD, no commission
   *       proceedsPln = 100 * 180 * 4.2 = 75 600
   *       gainLossPln = 75 600 - 60 000 = 15 600
   *       taxPln      = 15 600 * 0.19   =  2 964
   */
  void it('sell in year N uses cost basis from buy in year N-1', () => {
    const buyPriorYear = makeTrade({
      datetime: new Date(2023, 8, 15), // Sep 2023 — before taxPeriod2024.from
      quantity: 100,
      price: 150,
      proceeds: 0,
      type: 'buy',
      commission: 0,
      exchangeRate: 4.0,
      commissionExchangeRate: 4.0,
    });
    const sellCurrentYear = makeTrade({
      datetime: new Date(2024, 5, 20), // Jun 2024 — inside taxPeriod2024
      quantity: 100,
      price: 180,
      proceeds: 18000,
      type: 'sell',
      commission: 0,
      exchangeRate: 4.2,
      commissionExchangeRate: 4.2,
    });

    const result = calculateCapitalGains({
      trades: [buyPriorYear, sellCurrentYear],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    // Only the sell falls within taxPeriod2024 → one result
    assert.equal(result.length, 1);
    assert.equal(result[0].type, 'sell');

    // proceedsPln = 18000 * 4.2 = 75 600
    assert.ok(
      Math.abs(result[0].proceedsPln - 75600) < 0.01,
      `proceedsPln: ${String(result[0].proceedsPln)}`,
    );
    // costPln = 100 * 150 * 4.0 = 60 000 (prior-year FIFO lot)
    assert.ok(
      Math.abs(result[0].costPln - 60000) < 0.01,
      `costPln: ${String(result[0].costPln)}`,
    );
    // gainLossPln = 75 600 − 60 000 = 15 600
    assert.ok(
      Math.abs(result[0].gainLossPln - 15600) < 0.01,
      `gainLossPln: ${String(result[0].gainLossPln)}`,
    );
    // taxPln = 15 600 * 0.19 = 2 964
    assert.ok(
      Math.abs(result[0].taxPln - 2964) < 0.01,
      `taxPln: ${String(result[0].taxPln)}`,
    );
  });

  void it('tolerates float-precision residue when consuming buy lots', () => {
    // 0.1 + 0.2 === 0.30000000000000004 in IEEE-754. Two buys of 0.1 and 0.2
    // followed by a sell of (0.1 + 0.2) used to throw "Insufficient buy lots"
    // because remainingQty after the second lot was ~4e-17, not zero.
    const buy1 = makeTrade({
      datetime: new Date(2024, 0, 10),
      quantity: 0.1,
      price: 100,
      type: 'buy',
      commission: 0,
    });
    const buy2 = makeTrade({
      datetime: new Date(2024, 0, 11),
      quantity: 0.2,
      price: 100,
      type: 'buy',
      commission: 0,
    });
    const sell = makeTrade({
      datetime: new Date(2024, 5, 10),
      quantity: 0.1 + 0.2,
      price: 120,
      proceeds: (0.1 + 0.2) * 120,
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
    // costPln = 0.3 * 100 * 4.0 = 120
    assert.ok(
      Math.abs(sellResult.costPln - 120) < 0.01,
      `costPln: ${String(sellResult.costPln)}`,
    );
  });

  void it('still throws when truly short beyond epsilon tolerance', () => {
    const buy = makeTrade({
      datetime: new Date(2024, 0, 10),
      quantity: 10,
      price: 100,
      type: 'buy',
      commission: 0,
    });
    const sell = makeTrade({
      datetime: new Date(2024, 5, 10),
      quantity: 11, // 1 share over what was bought — real shortfall
      price: 120,
      proceeds: 1320,
      type: 'sell',
      commission: 0,
    });

    assert.throws(
      () =>
        calculateCapitalGains({
          trades: [buy, sell],
          corporateActions: [],
          carryInPositions: [],
          taxPeriod: taxPeriod2024,
        }),
      /Insufficient buy lots/,
    );
  });

  void it('handles IBKR fractional-share quantities (4 decimals)', () => {
    // IBKR allows fractional shares with up to 4 decimal places, e.g. 1.2345.
    // Summing them accumulates IEEE-754 drift:
    //   1.2345 + 2.3456 + 3.4567 === 7.0367999999999995
    // FIFO must still consume all three lots cleanly.
    const buy1 = makeTrade({
      datetime: new Date(2024, 0, 10),
      quantity: 1.2345,
      price: 100,
      type: 'buy',
      commission: 0,
    });
    const buy2 = makeTrade({
      datetime: new Date(2024, 0, 11),
      quantity: 2.3456,
      price: 100,
      type: 'buy',
      commission: 0,
    });
    const buy3 = makeTrade({
      datetime: new Date(2024, 0, 12),
      quantity: 3.4567,
      price: 100,
      type: 'buy',
      commission: 0,
    });
    const totalQty = 1.2345 + 2.3456 + 3.4567; // 7.0367999999999995
    const sell = makeTrade({
      datetime: new Date(2024, 5, 10),
      quantity: totalQty,
      price: 120,
      proceeds: totalQty * 120,
      type: 'sell',
      commission: 0,
    });

    const result = calculateCapitalGains({
      trades: [buy1, buy2, buy3, sell],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    const sellResult = result.find((r) => r.type === 'sell');
    assert.ok(sellResult, 'Expected a sell result');
    // costPln = 7.0368 * 100 * 4.0 = 2814.72
    assert.ok(
      Math.abs(sellResult.costPln - 2814.72) < 0.01,
      `costPln: ${String(sellResult.costPln)}`,
    );
    // proceedsPln = totalQty * 120 * 4.0 = 7.0368 * 480 = 3377.664
    assert.ok(
      Math.abs(sellResult.proceedsPln - 3377.664) < 0.01,
      `proceedsPln: ${String(sellResult.proceedsPln)}`,
    );
  });

  void it('handles fractional partial lot consumption with correct cost basis', () => {
    // Buy fractional shares at different prices, sell partial across lots.
    // FIFO must split lot2 cleanly and preserve the remainder.
    const buy1 = makeTrade({
      datetime: new Date(2024, 0, 10),
      quantity: 1.2345,
      price: 100,
      type: 'buy',
      commission: 0,
    });
    const buy2 = makeTrade({
      datetime: new Date(2024, 0, 11),
      quantity: 2.3456,
      price: 200,
      type: 'buy',
      commission: 0,
    });
    const sell1 = makeTrade({
      datetime: new Date(2024, 3, 10),
      quantity: 2, // consumes all of buy1 (1.2345) + 0.7655 of buy2
      price: 150,
      proceeds: 300,
      type: 'sell',
      commission: 0,
    });
    const sell2 = makeTrade({
      datetime: new Date(2024, 4, 10),
      quantity: 1.5801, // 2.3456 - 0.7655 = 1.5801, all from buy2 remainder
      price: 160,
      proceeds: 1.5801 * 160,
      type: 'sell',
      commission: 0,
    });

    const result = calculateCapitalGains({
      trades: [buy1, buy2, sell1, sell2],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    const sells = result.filter((r) => r.type === 'sell');
    assert.equal(sells.length, 2);
    // sell1 cost = 1.2345 * 100 * 4 + 0.7655 * 200 * 4 = 493.8 + 612.4 = 1106.2
    assert.ok(
      Math.abs(sells[0].costPln - 1106.2) < 0.01,
      `sell1 costPln: ${String(sells[0].costPln)}`,
    );
    // sell2 cost = 1.5801 * 200 * 4 = 1264.08
    assert.ok(
      Math.abs(sells[1].costPln - 1264.08) < 0.01,
      `sell2 costPln: ${String(sells[1].costPln)}`,
    );
  });

  void it('detects real fractional shortfall below 1 share', () => {
    // Don't let epsilon mask genuine fractional shortfall.
    // Buy 1.2345, sell 1.2346 — 0.0001 short, must throw.
    const buy = makeTrade({
      datetime: new Date(2024, 0, 10),
      quantity: 1.2345,
      price: 100,
      type: 'buy',
      commission: 0,
    });
    const sell = makeTrade({
      datetime: new Date(2024, 5, 10),
      quantity: 1.2346,
      price: 120,
      proceeds: 148.152,
      type: 'sell',
      commission: 0,
    });

    assert.throws(
      () =>
        calculateCapitalGains({
          trades: [buy, sell],
          corporateActions: [],
          carryInPositions: [],
          taxPeriod: taxPeriod2024,
        }),
      /Insufficient buy lots/,
    );
  });

  void it('detects tiny real shortfall on large share quantities', () => {
    // The scaled epsilon is capped, so a 0.0001-share shortfall remains
    // visible even when the sell quantity is large.
    const buy = makeTrade({
      datetime: new Date(2024, 0, 10),
      quantity: 100_000,
      price: 100,
      type: 'buy',
      commission: 0,
    });
    const sell = makeTrade({
      datetime: new Date(2024, 5, 10),
      quantity: 100_000.0001,
      price: 120,
      proceeds: 12_000_000.012,
      type: 'sell',
      commission: 0,
    });

    assert.throws(
      () =>
        calculateCapitalGains({
          trades: [buy, sell],
          corporateActions: [],
          carryInPositions: [],
          taxPeriod: taxPeriod2024,
        }),
      /Insufficient buy lots/,
    );
  });

  void it('treats lot remainder within epsilon as fully consumed', () => {
    // Sell qty equal to lot qty up to float drift — lot must be removed,
    // not left as a near-zero ghost lot that breaks subsequent FIFO.
    const buy1 = makeTrade({
      datetime: new Date(2024, 0, 10),
      quantity: 0.1 + 0.2, // 0.30000000000000004
      price: 100,
      type: 'buy',
      commission: 0,
    });
    const buy2 = makeTrade({
      datetime: new Date(2024, 0, 11),
      quantity: 1,
      price: 200,
      type: 'buy',
      commission: 0,
    });
    const sell1 = makeTrade({
      datetime: new Date(2024, 3, 10),
      quantity: 0.3, // exact 0.3, leaves ~4e-17 in lot1
      price: 110,
      proceeds: 33,
      type: 'sell',
      commission: 0,
    });
    const sell2 = makeTrade({
      datetime: new Date(2024, 4, 10),
      quantity: 1, // must come from buy2 at price 200, not the ghost lot1
      price: 220,
      proceeds: 220,
      type: 'sell',
      commission: 0,
    });

    const result = calculateCapitalGains({
      trades: [buy1, buy2, sell1, sell2],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    const sells = result.filter((r) => r.type === 'sell');
    assert.equal(sells.length, 2);
    // sell2 uses buy2: 1 * 200 * 4.0 = 800
    assert.ok(
      Math.abs(sells[1].costPln - 800) < 0.01,
      `sell2 costPln: ${String(sells[1].costPln)}`,
    );
  });
});
