import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { roundToFullPln, roundToGroszUp } from '../src/core/tax/rounding.js';

void describe('roundToFullPln', () => {
  void it('rounds down below 0.5', () => {
    assert.equal(roundToFullPln({ amount: 1234.49 }), 1234);
  });

  void it('rounds up at 0.5', () => {
    assert.equal(roundToFullPln({ amount: 1234.5 }), 1235);
  });

  void it('rounds up above 0.5', () => {
    assert.equal(roundToFullPln({ amount: 1234.51 }), 1235);
  });

  void it('returns 0 for zero', () => {
    assert.equal(roundToFullPln({ amount: 0 }), 0);
  });

  void it('returns same value for already whole number', () => {
    assert.equal(roundToFullPln({ amount: 100 }), 100);
  });

  void it('handles negative values', () => {
    assert.equal(roundToFullPln({ amount: -100.6 }), -101);
  });

  void it('rounds negative -0.5 toward zero (JS Math.round behavior)', () => {
    assert.equal(roundToFullPln({ amount: -100.5 }), -100);
  });
});

void describe('roundToGroszUp', () => {
  void it('ceils fractional grosze', () => {
    assert.equal(roundToGroszUp({ amount: 1.001 }), 1.01);
  });

  void it('returns same value for already exact grosze', () => {
    assert.equal(roundToGroszUp({ amount: 1.23 }), 1.23);
  });

  void it('returns 0 for zero', () => {
    assert.equal(roundToGroszUp({ amount: 0 }), 0);
  });

  void it('handles typical tax calculation (33.33 * 0.19 = 6.3327)', () => {
    assert.equal(roundToGroszUp({ amount: 33.33 * 0.19 }), 6.34);
  });

  void it('handles floating point edge case (0.1 + 0.2)', () => {
    assert.equal(roundToGroszUp({ amount: 0.1 + 0.2 }), 0.3);
  });

  void it('ceils up even for tiny fraction above', () => {
    assert.equal(roundToGroszUp({ amount: 1.0001 }), 1.01);
  });

  void it('handles large amounts', () => {
    assert.equal(roundToGroszUp({ amount: 123456.781 }), 123456.79);
  });

  void it('handles negative amounts', () => {
    // Math.ceil rounds toward zero for negatives
    assert.equal(roundToGroszUp({ amount: -1.001 }), -1);
  });
});
