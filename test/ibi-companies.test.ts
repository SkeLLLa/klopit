import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveIbiTicker } from '../src/core/parsers/ibi/companies.js';

void describe('resolveIbiTicker', () => {
  void it('maps known multi-word company name to ticker', () => {
    assert.equal(resolveIbiTicker('monday.com'), 'MNDY');
    assert.equal(resolveIbiTicker('Check Point Software Technologies'), 'CHKP');
    assert.equal(resolveIbiTicker('WIX.COM'), 'WIX');
  });

  void it('returns the input uppercased when no mapping exists', () => {
    assert.equal(resolveIbiTicker('UnknownCo'), 'UNKNOWNCO');
    assert.equal(resolveIbiTicker('AAPL'), 'AAPL');
  });

  void it('is case- and whitespace-insensitive', () => {
    assert.equal(resolveIbiTicker('  Mobileye  '), 'MBLY');
    assert.equal(resolveIbiTicker('TEVA PHARMACEUTICAL INDUSTRIES'), 'TEVA');
  });

  void it('returns empty string for empty or whitespace-only input', () => {
    assert.equal(resolveIbiTicker(''), '');
    assert.equal(resolveIbiTicker('   '), '');
  });
});
