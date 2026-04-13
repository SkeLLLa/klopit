import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildPitZg } from '../src/core/tax/pit-zg.js';
import type { DividendResult, TradeResult } from '../src/core/types.js';

function makeSellResult(overrides: Partial<TradeResult> = {}): TradeResult {
  return {
    symbol: 'AAPL',
    datetime: new Date(2024, 6, 15),
    type: 'sell',
    source: 'trade',
    quantity: 100,
    price: 180,
    proceeds: 18000,
    commission: 10,
    currency: 'USD',
    exchangeRate: 4.0,
    proceedsPln: 71960,
    costPln: 60000,
    gainLossPln: 11960,
    rateUnavailable: false,
    country: 'US',
    ...overrides,
  };
}

function makeDivResult(
  overrides: Partial<DividendResult> = {},
): DividendResult {
  return {
    symbol: 'AAPL',
    currency: 'USD',
    date: new Date(2024, 2, 15),
    amountOriginal: 50,
    withholdingTaxOriginal: 7.5,
    amountPln: 200,
    withholdingTaxPln: 30,
    exchangeRate: 4.0,
    rateUnavailable: false,
    country: 'US',
    ...overrides,
  };
}

void describe('buildPitZg', () => {
  void it('returns empty array for no results', () => {
    const result = buildPitZg({ trades: [], dividends: [] });
    assert.deepEqual(result, []);
  });

  void it('groups trades by country', () => {
    const trades = [
      makeSellResult({
        country: 'US',
        proceedsPln: 50000,
        costPln: 30000,
        gainLossPln: 20000,
      }),
      makeSellResult({
        country: 'US',
        proceedsPln: 10000,
        costPln: 8000,
        gainLossPln: 2000,
      }),
      makeSellResult({
        country: 'DE',
        proceedsPln: 5000,
        costPln: 6000,
        gainLossPln: -1000,
      }),
    ];

    const result = buildPitZg({ trades, dividends: [] });
    assert.equal(result.length, 2);

    const us = result.find((r) => r.country === 'US');
    assert.ok(us);
    assert.equal(us.proceedsPln, 60000);
    assert.equal(us.costPln, 38000);
    assert.equal(us.gainPln, 22000);
    assert.equal(us.lossPln, 0);

    const de = result.find((r) => r.country === 'DE');
    assert.ok(de);
    assert.equal(de.proceedsPln, 5000);
    assert.equal(de.costPln, 6000);
    assert.equal(de.gainPln, 0);
    assert.equal(de.lossPln, 1000);
  });

  void it('groups dividends by country with per-dividend treaty cap', () => {
    const dividends = [
      // US: 100 PLN, 30 PLN withheld → deductible = min(30, 100 * 0.15 = 15) = 15
      makeDivResult({ country: 'US', amountPln: 100, withholdingTaxPln: 30 }),
      // US: 200 PLN, 20 PLN withheld → deductible = min(20, 200 * 0.15 = 30) = 20
      makeDivResult({ country: 'US', amountPln: 200, withholdingTaxPln: 20 }),
      // DE: 50 PLN, 5 PLN withheld → deductible = min(5, 50 * 0.15 = 7.5) = 5
      makeDivResult({ country: 'DE', amountPln: 50, withholdingTaxPln: 5 }),
      // ZZ (unknown): 100 PLN, 30 PLN withheld → deductible = min(30, 100 * 0.19 = 19) = 19
      makeDivResult({ country: 'ZZ', amountPln: 100, withholdingTaxPln: 30 }),
    ];

    const result = buildPitZg({ trades: [], dividends });
    assert.equal(result.length, 3);

    const us = result.find((r) => r.country === 'US');
    assert.ok(us);
    assert.equal(us.dividendIncomePln, 300);
    assert.equal(us.foreignTaxPaidPln, 50);
    // Deductible: 15 + 20 = 35 (treaty-capped)
    assert.ok(Math.abs(us.deductibleForeignTaxPln - 35) < 0.01);

    const de = result.find((r) => r.country === 'DE');
    assert.ok(de);
    assert.equal(de.dividendIncomePln, 50);
    assert.equal(de.foreignTaxPaidPln, 5);
    assert.ok(Math.abs(de.deductibleForeignTaxPln - 5) < 0.01);

    const zz = result.find((r) => r.country === 'ZZ');
    assert.ok(zz);
    assert.equal(zz.dividendIncomePln, 100);
    assert.equal(zz.foreignTaxPaidPln, 30);
    // Deductible: 19 (domestic 19% fallback for non-treaty country)
    assert.ok(Math.abs(zz.deductibleForeignTaxPln - 19) < 0.01);
  });

  void it('combines trades and dividends for same country', () => {
    const trades = [
      makeSellResult({
        country: 'US',
        proceedsPln: 50000,
        costPln: 30000,
        gainLossPln: 20000,
      }),
    ];
    const dividends = [
      makeDivResult({ country: 'US', amountPln: 200, withholdingTaxPln: 30 }),
    ];

    const result = buildPitZg({ trades, dividends });
    assert.equal(result.length, 1);
    assert.equal(result[0].country, 'US');
    assert.equal(result[0].proceedsPln, 50000);
    assert.equal(result[0].dividendIncomePln, 200);
  });

  void it('excludes buy trades from aggregation', () => {
    const trades = [
      makeSellResult({
        type: 'buy',
        country: 'US',
        proceedsPln: 0,
        costPln: 0,
        gainLossPln: 0,
      }),
    ];

    const result = buildPitZg({ trades, dividends: [] });
    assert.deepEqual(result, []);
  });

  void it('sorts results by country code', () => {
    const trades = [
      makeSellResult({
        country: 'DE',
        proceedsPln: 1000,
        costPln: 500,
        gainLossPln: 500,
      }),
      makeSellResult({
        country: 'US',
        proceedsPln: 2000,
        costPln: 1000,
        gainLossPln: 1000,
      }),
    ];

    const result = buildPitZg({ trades, dividends: [] });
    assert.equal(result[0].country, 'DE');
    assert.equal(result[1].country, 'US');
  });
});
