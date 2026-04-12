import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateTaxes } from '../src/core/tax/calculator.js';
import type {
  EnrichedCorporateAction,
  EnrichedRawDividend,
  EnrichedTrade,
  EnrichedWithholdingTax,
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
    commission: 0,
    commissionCurrency: 'USD',
    type: 'buy',
    exchangeRate: 4.0,
    commissionExchangeRate: 4.0,
    rateUnavailable: false,
    ...overrides,
  };
}

function makeDiv(overrides: Partial<EnrichedRawDividend>): EnrichedRawDividend {
  return {
    symbol: 'AAPL',
    currency: 'USD',
    date: new Date(2024, 1, 15),
    amount: 2.4,
    exchangeRate: 4.0,
    rateUnavailable: false,
    ...overrides,
  };
}

function makeTax(
  overrides: Partial<EnrichedWithholdingTax>,
): EnrichedWithholdingTax {
  return {
    symbol: 'AAPL',
    currency: 'USD',
    date: new Date(2024, 1, 15),
    amount: -0.36,
    exchangeRate: 4.0,
    rateUnavailable: false,
    ...overrides,
  };
}

void describe('calculateTaxes', () => {
  void it('returns all zeros for empty inputs', () => {
    const result = calculateTaxes({
      trades: [],
      dividends: [],
      withholdingTaxes: [],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    assert.deepEqual(result.trades, []);
    assert.deepEqual(result.dividends, []);
    assert.equal(result.summary.totalProceedsPln, 0);
    assert.equal(result.summary.totalCostPln, 0);
    assert.equal(result.summary.totalDividendsPln, 0);
    assert.equal(result.pit38[51], 0);
  });

  void it('handles full pipeline with trades and dividends', () => {
    const buy = makeTrade({
      datetime: new Date(2024, 0, 15),
      quantity: 100,
      price: 150,
      type: 'buy',
    });
    const sell = makeTrade({
      datetime: new Date(2024, 6, 15),
      quantity: 100,
      price: 180,
      proceeds: 18000,
      type: 'sell',
    });
    const div = makeDiv({ amount: 50 });
    const tax = makeTax({ amount: -7.5 });

    const result = calculateTaxes({
      trades: [buy, sell],
      dividends: [div],
      withholdingTaxes: [tax],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    // Trades
    assert.equal(result.trades.length, 2);
    assert.equal(result.trades.filter((t) => t.type === 'sell').length, 1);

    // Dividends
    assert.equal(result.dividends.length, 1);
    assert.ok(result.dividends[0].amountPln > 0);

    // Summary — only sell contributes
    assert.ok(result.summary.totalProceedsPln > 0);
    assert.ok(result.summary.totalCostPln > 0);
    assert.ok(result.summary.totalDividendsPln > 0);

    // PIT-38 total tax > 0
    assert.ok(result.pit38[51] > 0);
    assert.equal(result.pit38[51], result.pit38[35] + result.pit38[49]);
  });

  void it('handles trades only (no dividends)', () => {
    const buy = makeTrade({
      datetime: new Date(2024, 0, 15),
      quantity: 50,
      price: 100,
      type: 'buy',
    });
    const sell = makeTrade({
      datetime: new Date(2024, 6, 15),
      quantity: 50,
      price: 120,
      proceeds: 6000,
      type: 'sell',
    });

    const result = calculateTaxes({
      trades: [buy, sell],
      dividends: [],
      withholdingTaxes: [],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    assert.ok(result.summary.totalProceedsPln > 0);
    assert.equal(result.summary.totalDividendsPln, 0);
    assert.equal(result.pit38[47], 0);
    assert.equal(result.pit38[49], 0);
    assert.equal(result.pit38[51], result.pit38[35]);
  });

  void it('handles dividends only (no trades)', () => {
    const div = makeDiv({ amount: 100 });
    const tax = makeTax({ amount: -15 });

    const result = calculateTaxes({
      trades: [],
      dividends: [div],
      withholdingTaxes: [tax],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    assert.equal(result.summary.totalProceedsPln, 0);
    assert.equal(result.summary.totalCostPln, 0);
    assert.equal(result.pit38[35], 0);
    assert.ok(result.summary.totalDividendsPln > 0);
    assert.equal(result.pit38[51], result.pit38[49]);
  });

  void it('aggregates only sell trades into summary', () => {
    const buy = makeTrade({
      datetime: new Date(2024, 0, 15),
      quantity: 100,
      price: 100,
      type: 'buy',
    });

    const result = calculateTaxes({
      trades: [buy],
      dividends: [],
      withholdingTaxes: [],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    // Only buy, no sell — summary should be zero
    assert.equal(result.summary.totalProceedsPln, 0);
    assert.equal(result.summary.totalCostPln, 0);
    assert.equal(result.summary.capitalGainPln, 0);
  });

  void it('caps withholding per-dividend, not in aggregate', () => {
    // Dividend 1: 25 USD at rate 4.0 = 100 PLN, 30% foreign tax = 7.5 USD = 30 PLN
    // Dividend 2: 25 USD at rate 4.0 = 100 PLN, 0% foreign tax = 0 PLN
    const div1 = makeDiv({
      symbol: 'HIGH',
      amount: 25,
      date: new Date(2024, 2, 15),
    });
    const tax1 = makeTax({
      symbol: 'HIGH',
      amount: -7.5, // 30%
      date: new Date(2024, 2, 15),
    });
    const div2 = makeDiv({
      symbol: 'ZERO',
      amount: 25,
      date: new Date(2024, 3, 15),
    });
    // No withholding for div2

    const result = calculateTaxes({
      trades: [],
      dividends: [div1, div2],
      withholdingTaxes: [tax1],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    // Raw withholding: 30 PLN total
    assert.ok(
      Math.abs(result.summary.totalWithholdingPln - 30) < 0.01,
      `totalWithholdingPln: ${String(result.summary.totalWithholdingPln)}`,
    );
    // Deductible: min(30, 19) + min(0, 19) = 19 PLN (capped per-dividend at 19%)
    assert.ok(
      Math.abs(result.summary.totalDeductibleWithholdingPln - 19) < 0.01,
      `totalDeductibleWithholdingPln: ${String(result.summary.totalDeductibleWithholdingPln)}`,
    );
    // Tax owed: 200 * 19% - 19 = 19 PLN (not 200 * 19% - 30 = 8 PLN)
    assert.ok(
      Math.abs(result.summary.dividendTaxOwedPln - 19) < 0.01,
      `dividendTaxOwedPln: ${String(result.summary.dividendTaxOwedPln)}`,
    );
    // PIT-38 poz49 should reflect the per-dividend cap
    assert.equal(result.pit38[49], 19);
  });

  void it('accounts for merger cash-per-share in capital gains', () => {
    // Buy 100 shares at $150 each, rate 4.0 → cost = 100 * 150 * 4.0 = 60000 PLN
    const buy = makeTrade({
      symbol: 'OLD',
      isin: 'US0000000001',
      datetime: new Date(2024, 0, 15),
      quantity: 100,
      price: 150,
      type: 'buy',
    });

    // Merger: OLD → NEW at 0.5 ratio + $10 cash per share, rate 4.0
    // New shares FMV = $7500 (50 new shares at $150 each)
    const merger: EnrichedCorporateAction = {
      type: 'merger',
      symbol: 'OLD',
      isin: 'US0000000001',
      datetime: new Date(2024, 6, 1),
      numerator: 1,
      denominator: 1,
      targetSymbol: 'NEW',
      targetIsin: 'US0000000002',
      conversionRatio: 0.5,
      cashPerShare: 10,
      cashCurrency: 'USD',
      cashExchangeRate: 4.0,
      cashRateUnavailable: false,
      newSharesValue: 7500,
    };

    const result = calculateTaxes({
      trades: [buy],
      dividends: [],
      withholdingTaxes: [],
      corporateActions: [merger],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    // Cash proceeds = 100 * $10 = $1000, PLN = $1000 * 4.0 = 4000 PLN
    // Total consideration = $1000 + $7500 = $8500
    // Cash fraction = 1000 / 8500 ≈ 0.11765
    // Cost allocated to cash = 60000 * 0.11765 ≈ 7058.82 PLN
    // Gain from cash = 4000 - 7058.82 ≈ -3058.82 PLN (loss because bought at $150, consideration ~$85)
    const syntheticSell = result.trades.find(
      (t) => t.type === 'sell' && t.symbol === 'OLD',
    );
    assert.ok(syntheticSell, 'should have synthetic sell for cash proceeds');
    assert.equal(syntheticSell.source, 'corporate-action');
    assert.ok(
      Math.abs(syntheticSell.proceedsPln - 4000) < 0.01,
      `proceedsPln: ${String(syntheticSell.proceedsPln)}`,
    );
    // Cash cost = 60000 * (1000 / 8500) ≈ 7058.82
    const expectedCashCost = 60000 * (1000 / 8500);
    assert.ok(
      Math.abs(syntheticSell.costPln - expectedCashCost) < 0.01,
      `costPln: ${String(syntheticSell.costPln)} vs expected ${String(expectedCashCost)}`,
    );
    assert.equal(syntheticSell.rateUnavailable, false);

    // Summary should include the cash proceeds
    assert.ok(
      Math.abs(result.summary.totalProceedsPln - 4000) < 0.01,
      `totalProceedsPln should include merger cash: ${String(result.summary.totalProceedsPln)}`,
    );
  });

  void it('tags results with country from symbolCountryMap', () => {
    const buy = makeTrade({
      symbol: 'AAPL',
      isin: 'US0378331005',
      datetime: new Date(2024, 0, 15),
      quantity: 100,
      price: 150,
      type: 'buy',
    });
    const sell = makeTrade({
      symbol: 'AAPL',
      isin: 'US0378331005',
      datetime: new Date(2024, 6, 15),
      quantity: 100,
      price: 180,
      proceeds: 18000,
      type: 'sell',
    });
    const div = makeDiv({ symbol: 'AAPL', amount: 50 });
    const tax = makeTax({ symbol: 'AAPL', amount: -7.5 });

    const symbolCountryMap = new Map([['AAPL', 'US']]);

    const result = calculateTaxes({
      trades: [buy, sell],
      dividends: [div],
      withholdingTaxes: [tax],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
      symbolCountryMap,
    });

    // All results tagged with US
    for (const t of result.trades) {
      assert.equal(t.country, 'US');
    }
    for (const d of result.dividends) {
      assert.equal(d.country, 'US');
    }

    // PIT/ZG has one entry for US
    assert.equal(result.pitZg.length, 1);
    assert.equal(result.pitZg[0].country, 'US');
    assert.ok(result.pitZg[0].proceedsPln > 0);
    assert.ok(result.pitZg[0].dividendIncomePln > 0);
  });

  void it('defaults country to XX when symbolCountryMap not provided', () => {
    const buy = makeTrade({
      datetime: new Date(2024, 0, 15),
      quantity: 50,
      price: 100,
      type: 'buy',
    });
    const sell = makeTrade({
      datetime: new Date(2024, 6, 15),
      quantity: 50,
      price: 120,
      proceeds: 6000,
      type: 'sell',
    });

    const result = calculateTaxes({
      trades: [buy, sell],
      dividends: [],
      withholdingTaxes: [],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    for (const t of result.trades) {
      assert.equal(t.country, 'XX');
    }
    assert.equal(result.pitZg.length, 1);
    assert.equal(result.pitZg[0].country, 'XX');
  });

  void it('includes prior year loss in PIT-38 calculation', () => {
    const buy = makeTrade({
      datetime: new Date(2024, 0, 15),
      quantity: 100,
      price: 100,
      type: 'buy',
    });
    const sell = makeTrade({
      datetime: new Date(2024, 6, 15),
      quantity: 100,
      price: 200,
      proceeds: 20000,
      type: 'sell',
    });

    const withLoss = calculateTaxes({
      trades: [buy, sell],
      dividends: [],
      withholdingTaxes: [],
      corporateActions: [],
      carryInPositions: [],
      priorYearLoss: 10000,
      taxPeriod: taxPeriod2024,
    });

    const withoutLoss = calculateTaxes({
      trades: [buy, sell],
      dividends: [],
      withholdingTaxes: [],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    // Same summary, different PIT-38
    assert.equal(
      withLoss.summary.totalProceedsPln,
      withoutLoss.summary.totalProceedsPln,
    );
    assert.ok(withLoss.pit38[35] < withoutLoss.pit38[35]);
  });
});
