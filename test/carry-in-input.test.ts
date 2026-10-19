import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CarryInPosition } from '../src/core/types.js';
import {
  CarryInValidationError,
  normalizeCarryInPosition,
  parseDecimalInput,
} from '../src/lib/services/carry-in.js';

const base: CarryInPosition = { symbol: ' aapl ', quantity: 10, year: 2023 };

function codeOf(pos: CarryInPosition, sessionYear?: number): string {
  try {
    normalizeCarryInPosition(pos, { sessionYear });
  } catch (error) {
    if (error instanceof CarryInValidationError) return error.code;
    throw error;
  }
  return 'ok';
}

void describe('parseDecimalInput', () => {
  void it('accepts text and number input values', () => {
    assert.equal(parseDecimalInput('1 234,5'), 1234.5);
    assert.equal(parseDecimalInput(' 12.25 '), 12.25);
    assert.equal(parseDecimalInput(42), 42);
    assert.equal(parseDecimalInput(''), undefined);
    assert.equal(parseDecimalInput('  '), undefined);
    assert.equal(parseDecimalInput(null), undefined);
    assert.equal(parseDecimalInput(undefined), undefined);
    assert.ok(Number.isNaN(parseDecimalInput('12abc')));
  });
});

void describe('normalizeCarryInPosition', () => {
  void it('normalizes the symbol and marks the cost missing', () => {
    const pos = normalizeCarryInPosition(base, { sessionYear: 2024 });
    assert.equal(pos.symbol, 'AAPL');
    assert.equal(pos.costBasisSource, 'missing');
    assert.equal(pos.currency, undefined);
  });

  void it('defaults a cost without currency to PLN', () => {
    const pos = normalizeCarryInPosition({ ...base, costBasis: 500 });
    assert.equal(pos.currency, 'PLN');
    assert.equal(pos.costBasisSource, 'user');
  });

  void it('keeps an explicit zero-cost confirmation only without a cost', () => {
    assert.equal(
      normalizeCarryInPosition({ ...base, costBasisSource: 'zero-confirmed' })
        .costBasisSource,
      'zero-confirmed',
    );
  });

  void it('rejects invalid input', () => {
    assert.equal(codeOf({ ...base, symbol: ' ' }), 'symbol-required');
    assert.equal(codeOf({ ...base, quantity: 0 }), 'quantity-invalid');
    assert.equal(codeOf({ ...base, quantity: Number.NaN }), 'quantity-invalid');
    assert.equal(codeOf({ ...base, year: 0 }), 'year-invalid');
    assert.equal(codeOf({ ...base, year: 2024 }, 2024), 'year-not-prior');
    assert.equal(codeOf(base, 2024), 'ok');
    assert.equal(
      codeOf({ ...base, acquisitionDate: new Date(2024, 0, 2) }),
      'date-after-year',
    );
    assert.equal(
      codeOf({ ...base, acquisitionDate: new Date(2023, 11, 31) }),
      'ok',
    );
    assert.equal(codeOf({ ...base, costBasis: -1 }), 'cost-invalid');
    assert.equal(
      codeOf({ ...base, costBasis: Number.NaN, currency: 'PLN' }),
      'cost-invalid',
    );
  });

  void it('requires an acquisition date for a foreign-currency cost', () => {
    assert.equal(
      codeOf({ ...base, costBasis: 100, currency: 'USD' }),
      'date-required-for-fx',
    );
    assert.equal(
      codeOf({
        ...base,
        costBasis: 100,
        currency: 'USD',
        acquisitionDate: new Date(2023, 4, 10),
      }),
      'ok',
    );
    assert.equal(
      codeOf({ ...base, costBasis: 100, currency: 'USD', costBasisPln: 400 }),
      'ok',
    );
  });
});
