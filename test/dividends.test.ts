import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateDividends } from '../src/core/tax/dividends.js';
import type {
  EnrichedRawDividend,
  EnrichedWithholdingTax,
  TaxPeriod,
} from '../src/core/types.js';

const taxPeriod2024: TaxPeriod = {
  year: 2024,
  from: new Date(2024, 0, 1),
  to: new Date(2024, 11, 31),
};

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

void describe('calculateDividends', () => {
  void it('returns empty array for empty inputs', () => {
    const result = calculateDividends({
      dividends: [],
      withholdingTaxes: [],
      taxPeriod: taxPeriod2024,
    });
    assert.deepEqual(result, []);
  });

  void it('calculates single dividend with withholding', () => {
    const div = makeDiv({ amount: 2.4 });
    const tax = makeTax({ amount: -0.36 });

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [tax],
      taxPeriod: taxPeriod2024,
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].amountOriginal, 2.4);
    assert.equal(result[0].withholdingTaxOriginal, 0.36); // abs(-0.36)
    assert.ok(
      Math.abs(result[0].amountPln - 9.6) < 0.01,
      `amountPln: ${String(result[0].amountPln)}`,
    ); // 2.4 * 4.0
    assert.ok(
      Math.abs(result[0].withholdingTaxPln - 1.44) < 0.01,
      `withholdingPln: ${String(result[0].withholdingTaxPln)}`,
    ); // 0.36 * 4.0
    assert.equal(result[0].rateUnavailable, false);
  });

  void it('handles dividend with no withholding', () => {
    const div = makeDiv({ amount: 5.0 });

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [],
      taxPeriod: taxPeriod2024,
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].withholdingTaxOriginal, 0);
    assert.equal(result[0].withholdingTaxPln, 0);
  });

  void it('sums multiple withholding entries for one dividend', () => {
    const div = makeDiv({
      date: new Date(2024, 4, 15),
      amount: 10.0,
    });
    const tax1 = makeTax({
      date: new Date(2024, 4, 15),
      amount: -1.0,
    });
    const tax2 = makeTax({
      date: new Date(2024, 4, 15),
      amount: -0.5,
    });

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [tax1, tax2],
      taxPeriod: taxPeriod2024,
    });

    assert.equal(result.length, 1);
    assert.ok(
      Math.abs(result[0].withholdingTaxOriginal - 1.5) < 0.01,
      `withholdingOriginal: ${String(result[0].withholdingTaxOriginal)}`,
    );
  });

  void it('matches by ISIN when present', () => {
    const div = makeDiv({
      symbol: 'AAPL',
      isin: 'US0378331005',
      date: new Date(2024, 1, 15),
    });
    const taxMatch = makeTax({
      symbol: 'DIFFERENT',
      isin: 'US0378331005', // Same ISIN
      date: new Date(2024, 1, 15),
    });
    const taxNoMatch = makeTax({
      symbol: 'AAPL',
      isin: 'OTHERIS1N', // Different ISIN
      date: new Date(2024, 1, 15),
      amount: -99,
    });

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [taxMatch, taxNoMatch],
      taxPeriod: taxPeriod2024,
    });

    assert.equal(result.length, 1);
    // Only taxMatch should match (by ISIN)
    assert.ok(
      Math.abs(result[0].withholdingTaxOriginal - 0.36) < 0.01,
      `Should match by ISIN, got: ${String(result[0].withholdingTaxOriginal)}`,
    );
  });

  void it('falls back to symbol matching when no ISIN', () => {
    const div = makeDiv({ symbol: 'AAPL', date: new Date(2024, 3, 10) });
    const tax = makeTax({
      symbol: 'AAPL',
      date: new Date(2024, 3, 10),
      amount: -0.5,
    });

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [tax],
      taxPeriod: taxPeriod2024,
    });

    assert.ok(
      Math.abs(result[0].withholdingTaxOriginal - 0.5) < 0.01,
      `withholdingOriginal: ${String(result[0].withholdingTaxOriginal)}`,
    );
  });

  void it('matches case-insensitively', () => {
    const div = makeDiv({ symbol: 'aapl', date: new Date(2024, 3, 10) });
    const tax = makeTax({
      symbol: 'AAPL',
      date: new Date(2024, 3, 10),
      amount: -0.5,
    });

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [tax],
      taxPeriod: taxPeriod2024,
    });

    assert.ok(
      Math.abs(result[0].withholdingTaxOriginal - 0.5) < 0.01,
      'Should match case-insensitively',
    );
  });

  void it('excludes dividends outside tax period', () => {
    const divIn = makeDiv({ date: new Date(2024, 5, 15) });
    const divOut = makeDiv({ date: new Date(2023, 5, 15) }); // Before 2024

    const result = calculateDividends({
      dividends: [divIn, divOut],
      withholdingTaxes: [],
      taxPeriod: taxPeriod2024,
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].date.getFullYear(), 2024);
  });

  void it('propagates rateUnavailable from dividend', () => {
    const div = makeDiv({ rateUnavailable: true, exchangeRate: 0 });

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [],
      taxPeriod: taxPeriod2024,
    });

    assert.equal(result[0].rateUnavailable, true);
  });

  void it('propagates rateUnavailable from withholding', () => {
    const div = makeDiv({});
    const tax = makeTax({ rateUnavailable: true });

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [tax],
      taxPeriod: taxPeriod2024,
    });

    assert.equal(result[0].rateUnavailable, true);
  });

  void it('handles negative withholding amounts with Math.abs', () => {
    const div = makeDiv({ amount: 10 });
    const tax = makeTax({ amount: -1.5 });

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [tax],
      taxPeriod: taxPeriod2024,
    });

    assert.equal(result[0].withholdingTaxOriginal, 1.5);
    assert.ok(
      Math.abs(result[0].withholdingTaxPln - 6) < 0.01,
      `withholdingPln: ${String(result[0].withholdingTaxPln)}`,
    ); // 1.5 * 4.0
  });

  void it('handles EUR dividend with EUR withholding', () => {
    const div = makeDiv({
      symbol: 'RHM',
      currency: 'EUR',
      amount: 8.1,
      exchangeRate: 4.3, // EUR rate
    });
    const tax = makeTax({
      symbol: 'RHM',
      currency: 'EUR',
      amount: -2.14,
      exchangeRate: 4.3,
    });

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [tax],
      taxPeriod: taxPeriod2024,
    });

    assert.equal(result.length, 1);
    assert.ok(Math.abs(result[0].amountPln - 34.83) < 0.01); // 8.1 * 4.3
    assert.ok(Math.abs(result[0].withholdingTaxPln - 9.202) < 0.01); // 2.14 * 4.3
  });

  void it('handles NOK dividend', () => {
    const div = makeDiv({
      symbol: 'SOC',
      currency: 'NOK',
      amount: 325,
      exchangeRate: 0.38, // NOK rate
    });

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [],
      taxPeriod: taxPeriod2024,
    });

    assert.equal(result.length, 1);
    assert.ok(Math.abs(result[0].amountPln - 123.5) < 0.01); // 325 * 0.38
  });
});
