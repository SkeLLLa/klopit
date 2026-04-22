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
    taxPln: 2272.4,
    foreignTaxPln: 0,
    foreignTaxOriginal: 0,
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
    creditCapRate: 0.15,
    deductibleWithholdingPln: 30,
    taxPlnGross: 38,
    taxToPayPln: 8,
    ...overrides,
  };
}

void describe('buildPitZg', () => {
  void it('returns empty array for no results', () => {
    const result = buildPitZg({
      trades: [],
      dividends: [],
      includeAll: false,
    });
    assert.deepEqual(result, []);
  });

  void describe('includeAll: false (default)', () => {
    void it('includes dividends with foreign tax withheld', () => {
      const dividends = [
        makeDivResult({
          country: 'US',
          amountPln: 200,
          withholdingTaxPln: 30,
          deductibleWithholdingPln: 15,
        }),
      ];
      const result = buildPitZg({
        trades: [],
        dividends,
        includeAll: false,
      });
      assert.equal(result.length, 1);
      assert.equal(result[0].country, 'US');
      assert.equal(result[0].dividendIncomePln, 200);
      assert.equal(result[0].dividendForeignTaxPln, 30);
      assert.equal(result[0].deductibleDividendTaxPln, 15);
      assert.equal(result[0].proceedsPln, undefined);
    });

    void it('excludes dividends with no foreign tax', () => {
      const result = buildPitZg({
        trades: [],
        dividends: [
          makeDivResult({
            country: 'PL',
            amountPln: 100,
            withholdingTaxPln: 0,
            deductibleWithholdingPln: 0,
          }),
        ],
        includeAll: false,
      });
      assert.equal(result.length, 0);
    });

    void it('excludes trades with no foreign tax', () => {
      const result = buildPitZg({
        trades: [
          makeSellResult({
            country: 'US',
            proceedsPln: 50000,
            costPln: 30000,
            foreignTaxPln: 0,
          }),
        ],
        dividends: [],
        includeAll: false,
      });
      assert.equal(result.length, 0);
    });

    void it('includes trades with foreign tax > 0', () => {
      const result = buildPitZg({
        trades: [
          makeSellResult({
            country: 'US',
            proceedsPln: 50000,
            costPln: 30000,
            foreignTaxPln: 1500,
          }),
        ],
        dividends: [],
        includeAll: false,
      });
      assert.equal(result.length, 1);
      assert.equal(result[0].country, 'US');
      assert.equal(result[0].proceedsPln, 50000);
      assert.equal(result[0].costPln, 30000);
      assert.equal(result[0].gainPln, 20000);
      assert.equal(result[0].lossPln, 0);
      assert.equal(result[0].tradeForeignTaxPln, 1500);
    });
  });

  void describe('includeAll: true', () => {
    void it('includes trades and populates capital gains fields', () => {
      const result = buildPitZg({
        trades: [
          makeSellResult({
            country: 'US',
            proceedsPln: 50000,
            costPln: 30000,
            foreignTaxPln: 0,
          }),
        ],
        dividends: [],
        includeAll: true,
      });
      assert.equal(result.length, 1);
      assert.equal(result[0].country, 'US');
      assert.equal(result[0].proceedsPln, 50000);
      assert.equal(result[0].costPln, 30000);
      assert.equal(result[0].gainPln, 20000);
      assert.equal(result[0].tradeForeignTaxPln, 0);
    });

    void it('merges mixed trades and dividends by country', () => {
      const result = buildPitZg({
        trades: [
          makeSellResult({
            country: 'US',
            proceedsPln: 50000,
            costPln: 30000,
            foreignTaxPln: 1000,
          }),
        ],
        dividends: [
          makeDivResult({
            country: 'US',
            amountPln: 200,
            withholdingTaxPln: 30,
            deductibleWithholdingPln: 15,
          }),
        ],
        includeAll: true,
      });
      assert.equal(result.length, 1);
      assert.equal(result[0].country, 'US');
      assert.equal(result[0].dividendIncomePln, 200);
      assert.equal(result[0].dividendForeignTaxPln, 30);
      assert.equal(result[0].deductibleDividendTaxPln, 15);
      assert.equal(result[0].proceedsPln, 50000);
      assert.equal(result[0].tradeForeignTaxPln, 1000);
    });

    void it('includes zero-tax dividends when toggle is on', () => {
      const result = buildPitZg({
        trades: [],
        dividends: [
          makeDivResult({
            country: 'DE',
            amountPln: 100,
            withholdingTaxPln: 0,
            deductibleWithholdingPln: 0,
          }),
        ],
        includeAll: true,
      });
      assert.equal(result.length, 1);
      assert.equal(result[0].country, 'DE');
      assert.equal(result[0].dividendIncomePln, 100);
      assert.equal(result[0].dividendForeignTaxPln, 0);
    });

    void it('sorts results by country code', () => {
      const result = buildPitZg({
        trades: [makeSellResult({ country: 'US' })],
        dividends: [makeDivResult({ country: 'DE', withholdingTaxPln: 0 })],
        includeAll: true,
      });
      assert.equal(result[0].country, 'DE');
      assert.equal(result[1].country, 'US');
    });
  });
});
