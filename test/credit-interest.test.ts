import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateCreditInterest } from '../src/core/tax/credit-interest.js';
import type { EnrichedCreditInterest } from '../src/core/types.js';

const taxPeriod2024 = {
  year: 2024,
  from: new Date(2024, 0, 1),
  to: new Date(2024, 11, 31),
};

function makeCreditInterest(
  overrides: Partial<EnrichedCreditInterest> & { fxDate?: string } = {},
) {
  return {
    currency: 'USD',
    date: new Date(2024, 3, 5),
    amount: 10,
    description: 'USD Credit Interest for Mar-2024',
    exchangeRate: 4.2,
    fxDate: '2024-04-04',
    rateUnavailable: false,
    ...overrides,
  };
}

void describe('calculateCreditInterest', () => {
  void it('converts rows into PLN tax results', () => {
    const results = calculateCreditInterest({
      creditInterests: [makeCreditInterest()],
      taxPeriod: taxPeriod2024,
    });

    assert.equal(results.length, 1);
    assert.deepEqual(results[0], {
      currency: 'USD',
      date: new Date(2024, 3, 5),
      description: 'USD Credit Interest for Mar-2024',
      amountOriginal: 10,
      amountPln: 42,
      exchangeRate: 4.2,
      fxDate: '2024-04-04',
      rateUnavailable: false,
      taxPlnGross: 7.98,
      foreignTaxOriginal: 0,
      foreignTaxPln: 0,
      foreignTaxExchangeRate: 0,
    });
  });

  void it('filters rows outside the tax period', () => {
    const results = calculateCreditInterest({
      creditInterests: [
        makeCreditInterest({ date: new Date(2023, 11, 29) }),
        makeCreditInterest({ date: new Date(2025, 0, 2) }),
      ],
      taxPeriod: taxPeriod2024,
    });

    assert.deepEqual(results, []);
  });

  void it('preserves rate-unavailable rows with zero exchange rate', () => {
    const results = calculateCreditInterest({
      creditInterests: [
        makeCreditInterest({
          exchangeRate: 0,
          fxDate: '2024-04-05',
          rateUnavailable: true,
        }),
      ],
      taxPeriod: taxPeriod2024,
    });

    assert.equal(results[0]?.amountPln, 0);
    assert.equal(results[0]?.taxPlnGross, 0);
    assert.equal(results[0]?.rateUnavailable, true);
    assert.equal(results[0]?.fxDate, '2024-04-05');
  });
});
