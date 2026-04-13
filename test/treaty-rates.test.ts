import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  TREATY_DIVIDEND_RATE_MAP,
  getDividendCreditCapRate,
} from '../src/core/tax/treaty-rates.js';

void describe('TREATY_DIVIDEND_RATE_MAP', () => {
  void it('contains US at 15%', () => {
    assert.equal(TREATY_DIVIDEND_RATE_MAP.get('US'), 0.15);
  });

  void it('contains GB at 10%', () => {
    assert.equal(TREATY_DIVIDEND_RATE_MAP.get('GB'), 0.1);
  });

  void it('contains DE, FR, NL, IE, CH, CA at 15%', () => {
    for (const code of ['DE', 'FR', 'NL', 'IE', 'CH', 'CA']) {
      assert.equal(
        TREATY_DIVIDEND_RATE_MAP.get(code),
        0.15,
        `expected ${code} = 0.15`,
      );
    }
  });

  void it('contains JP at 10%', () => {
    assert.equal(TREATY_DIVIDEND_RATE_MAP.get('JP'), 0.1);
  });

  void it('uses uppercase ISO alpha-2 keys', () => {
    for (const key of TREATY_DIVIDEND_RATE_MAP.keys()) {
      assert.equal(key, key.toUpperCase(), `key ${key} must be uppercase`);
      assert.equal(key.length, 2, `key ${key} must be 2 chars`);
    }
  });

  void it('has no rate above 19%', () => {
    for (const [code, rate] of TREATY_DIVIDEND_RATE_MAP) {
      assert.ok(rate <= 0.19, `${code}: ${String(rate)} exceeds 19%`);
      assert.ok(rate >= 0, `${code}: ${String(rate)} is negative`);
    }
  });
});

void describe('getDividendCreditCapRate', () => {
  void it('returns treaty rate for known country (US = 15%)', () => {
    assert.equal(getDividendCreditCapRate({ country: 'US' }), 0.15);
  });

  void it('returns treaty rate for GB (10%)', () => {
    assert.equal(getDividendCreditCapRate({ country: 'GB' }), 0.1);
  });

  void it('is case-insensitive on input', () => {
    assert.equal(getDividendCreditCapRate({ country: 'us' }), 0.15);
    assert.equal(getDividendCreditCapRate({ country: 'Us' }), 0.15);
  });

  void it('falls back to 19% for unknown country', () => {
    assert.equal(getDividendCreditCapRate({ country: 'ZZ' }), 0.19);
  });

  void it('falls back to 19% for fallback XX code', () => {
    assert.equal(getDividendCreditCapRate({ country: 'XX' }), 0.19);
  });

  void it('falls back to 19% for empty string', () => {
    assert.equal(getDividendCreditCapRate({ country: '' }), 0.19);
  });

  void it('never exceeds domestic 19% cap', () => {
    for (const code of TREATY_DIVIDEND_RATE_MAP.keys()) {
      assert.ok(getDividendCreditCapRate({ country: code }) <= 0.19);
    }
  });
});
