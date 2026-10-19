import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildPitZg,
  creditableGainsForeignTaxPln,
  requiredPitZg,
} from '../src/core/tax/pit-zg.js';
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

const sell = (country: string, gain: number, tax: number) =>
  makeSellResult({
    country,
    proceedsPln: 10000 + Math.max(gain, 0),
    costPln: 10000 + Math.max(-gain, 0),
    foreignTaxPln: tax,
  });
const run = (trades: TradeResult[], t: number, d: number) =>
  creditableGainsForeignTaxPln(
    buildPitZg({
      trades,
      dividends: [],
      showDividends: false,
      taxBeforeCreditPln: t,
      totalIncomePln: d,
    }),
  );

void describe('buildPitZg', () => {
  void it('returns empty array for no results', () => {
    const result = buildPitZg({
      trades: [],
      dividends: [],
      showDividends: false,
    });
    assert.deepEqual(result, []);
  });

  void it('includes sell trades by country by default', () => {
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
      showDividends: false,
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].country, 'US');
    assert.equal(result[0].countryNamePl, 'Stany Zjednoczone');
    assert.equal(result[0].proceedsPln, 50000);
    assert.equal(result[0].costPln, 30000);
    assert.equal(result[0].gainPln, 20000);
    assert.equal(result[0].lossPln, 0);
    assert.equal(result[0].tradeForeignTaxPln, 1500);
  });

  void it('includes sell trades even when no foreign tax was paid', () => {
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
      showDividends: false,
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].tradeForeignTaxPln, 0);
  });

  void it('does not show PIT/ZG item 30 tax when item 29 income is zero', () => {
    const result = buildPitZg({
      trades: [
        makeSellResult({
          country: 'US',
          proceedsPln: 30000,
          costPln: 50000,
          foreignTaxPln: 100,
        }),
      ],
      dividends: [],
      showDividends: false,
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].gainPln, 0);
    assert.equal(result[0].lossPln, 20000);
    assert.equal(result[0].tradeForeignTaxPln, 0);
  });

  void it('ignores buy trades', () => {
    const result = buildPitZg({
      trades: [
        makeSellResult({
          type: 'buy',
          proceedsPln: 0,
          costPln: 0,
          foreignTaxPln: 1500,
        }),
      ],
      dividends: [],
      showDividends: false,
    });
    assert.equal(result.length, 0);
  });

  void it('does not include dividends by default', () => {
    const result = buildPitZg({
      trades: [],
      dividends: [makeDivResult()],
      showDividends: false,
    });
    assert.equal(result.length, 0);
  });

  void it('includes dividends when the compatibility setting is enabled', () => {
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
      showDividends: true,
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].country, 'DE');
    assert.equal(result[0].countryNamePl, 'Niemcy');
    assert.equal(result[0].dividendIncomePln, 100);
    assert.equal(result[0].dividendForeignTaxPln, 0);
    assert.equal(result[0].deductibleDividendTaxPln, 0);
  });

  void it('merges trades and dividends by country when dividends are enabled', () => {
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
      showDividends: true,
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].country, 'US');
    assert.equal(result[0].proceedsPln, 50000);
    assert.equal(result[0].tradeForeignTaxPln, 1000);
    assert.equal(result[0].dividendIncomePln, 200);
    assert.equal(result[0].dividendForeignTaxPln, 30);
    assert.equal(result[0].deductibleDividendTaxPln, 15);
  });

  void it('sorts results by country code', () => {
    const result = buildPitZg({
      trades: [
        makeSellResult({ country: 'US' }),
        makeSellResult({ country: 'DE' }),
      ],
      dividends: [],
      showDividends: false,
    });
    assert.equal(result[0].country, 'DE');
    assert.equal(result[1].country, 'US');
  });

  void it('marks a country with zero foreign tax as not required', () => {
    const result = buildPitZg({
      trades: [
        makeSellResult({ country: 'US', foreignTaxPln: 0 }),
        makeSellResult({ country: 'DE', foreignTaxPln: 0 }),
      ],
      dividends: [],
      showDividends: false,
    });
    assert.equal(result.length, 2);
    assert.ok(result.every((entry) => !entry.required));
    assert.deepEqual(requiredPitZg(result), []);
  });

  void it('marks a country with foreign tax as required and counts it', () => {
    const result = buildPitZg({
      trades: [
        makeSellResult({ country: 'US', foreignTaxPln: 0 }),
        makeSellResult({ country: 'DE', foreignTaxPln: 500 }),
      ],
      dividends: [],
      showDividends: false,
    });
    const de = result.find((entry) => entry.country === 'DE');
    const us = result.find((entry) => entry.country === 'US');
    assert.equal(de?.required, true);
    assert.equal(us?.required, false);
    assert.deepEqual(
      requiredPitZg(result).map((entry) => entry.country),
      ['DE'],
    );
  });

  void it('does not require a country whose net result is a loss', () => {
    const result = buildPitZg({
      trades: [
        makeSellResult({
          country: 'DE',
          proceedsPln: 1000,
          costPln: 2000,
          foreignTaxPln: 50,
        }),
      ],
      dividends: [],
      showDividends: false,
    });
    assert.equal(result[0].required, false);
  });

  void it('keeps dividend-only compatibility rows informational', () => {
    const result = buildPitZg({
      trades: [],
      dividends: [makeDivResult({ country: 'US' })],
      showDividends: true,
    });
    assert.equal(result[0].required, false);
  });

  void it('keeps dividend rows with withholding informational', () => {
    const result = buildPitZg({
      trades: [],
      dividends: [makeDivResult({ withholdingTaxPln: 30 })],
      showDividends: true,
    });
    assert.equal(result[0].required, false);
    assert.equal(result[0].proceedsPln, undefined);
    assert.equal(result[0].dividendForeignTaxPln, 30);
    assert.deepEqual(requiredPitZg(result), []);
  });

  void it('nets mixed gain and loss sells within a country', () => {
    const result = buildPitZg({
      trades: [
        makeSellResult({
          country: 'DE',
          proceedsPln: 10000,
          costPln: 4000,
          foreignTaxPln: 300,
        }),
        makeSellResult({
          country: 'DE',
          proceedsPln: 1000,
          costPln: 5000,
          foreignTaxPln: 0,
        }),
      ],
      dividends: [],
      showDividends: false,
    });
    assert.equal(result[0].gainPln, 2000);
    assert.equal(result[0].lossPln, 0);
    assert.equal(result[0].tradeForeignTaxPln, 300);
    // credit is capped by 19% of the 2000 gain = 380 -> 300 stays
    assert.equal(result[0].creditableForeignTaxPln, 300);
    assert.equal(result[0].required, true);
  });

  void it('zeroes foreign tax and drops required when the gain is 0', () => {
    const result = buildPitZg({
      trades: [
        makeSellResult({
          country: 'DE',
          proceedsPln: 1000,
          costPln: 1000,
          foreignTaxPln: 80,
        }),
      ],
      dividends: [],
      showDividends: false,
    });
    assert.equal(result[0].tradeForeignTaxPln, 0);
    assert.equal(result[0].required, false);
  });

  void it('caps the credit at 19% of the country gain', () => {
    const result = buildPitZg({
      trades: [
        makeSellResult({
          country: 'DE',
          proceedsPln: 2000,
          costPln: 1000,
          foreignTaxPln: 500,
        }),
      ],
      dividends: [],
      showDividends: false,
    });
    assert.equal(result[0].creditableForeignTaxPln, 190);
    assert.equal(result[0].required, true);
  });

  void it('is not required when Polish tax due is 0 after offsets', () => {
    const result = buildPitZg({
      trades: [
        makeSellResult({
          country: 'DE',
          proceedsPln: 2000,
          costPln: 1000,
          foreignTaxPln: 100,
        }),
      ],
      dividends: [],
      showDividends: false,
      taxBeforeCreditPln: 0,
      totalIncomePln: 1000,
    });
    assert.equal(result[0].creditableForeignTaxPln, 0);
    assert.equal(result[0].required, false);
  });

  void it('splits the Polish tax due proportionally across countries', () => {
    const result = buildPitZg({
      trades: [
        makeSellResult({
          country: 'DE',
          proceedsPln: 3000,
          costPln: 1000,
          foreignTaxPln: 300,
        }),
        makeSellResult({
          country: 'FR',
          proceedsPln: 2000,
          costPln: 1000,
          foreignTaxPln: 300,
        }),
      ],
      dividends: [],
      showDividends: false,
      taxBeforeCreditPln: 100,
      totalIncomePln: 3000,
    });
    const de = result.find((entry) => entry.country === 'DE');
    const fr = result.find((entry) => entry.country === 'FR');
    // DE: 100 * 2000/3000, FR: 100 * 1000/3000
    assert.ok(Math.abs((de?.creditableForeignTaxPln ?? 0) - 66.6667) < 0.001);
    assert.ok(Math.abs((fr?.creditableForeignTaxPln ?? 0) - 33.3333) < 0.001);
  });

  void describe('poz. 34 fixtures', () => {
    void it('Z1 loss elsewhere, two taxed countries', () => {
      assert.equal(
        run(
          [sell('DE', 2000, 100), sell('IL', 1000, 150), sell('US', -1500, 0)],
          285,
          1500,
        ),
        250,
      );
    });
    void it('Z2 partly taxed country', () => {
      assert.equal(
        run([sell('US', 1000, 300), sell('US', 4000, 0)], 950, 5000),
        190,
      );
    });
    void it('Z3 loss carry-forward, single country', () => {
      assert.equal(run([sell('DE', 2000, 380)], 190, 2000), 190);
    });
    void it('Z4 domestic loss', () => {
      assert.equal(
        run([sell('PL', -1000, 0), sell('DE', 2000, 300)], 190, 1000),
        190,
      );
    });
    void it('Z5 rounding from poz. 33', () => {
      assert.equal(run([sell('DE', 1000.4, 1000)], 190, 1000.4), 190);
    });
    void it('Z6 no foreign tax', () => {
      const list = buildPitZg({
        trades: [sell('DE', 2000, 0)],
        dividends: [],
        showDividends: false,
        taxBeforeCreditPln: 380,
        totalIncomePln: 2000,
      });
      assert.equal(creditableGainsForeignTaxPln(list), 0);
      assert.equal(requiredPitZg(list).length, 0);
    });
  });
});
