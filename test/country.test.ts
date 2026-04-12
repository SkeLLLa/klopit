import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isinToCountry } from '../src/core/tax/country.js';

void describe('isinToCountry', () => {
  void it('extracts US from US ISIN', () => {
    assert.equal(isinToCountry({ isin: 'US0378331005' }), 'US');
  });

  void it('extracts DE from German ISIN', () => {
    assert.equal(isinToCountry({ isin: 'DE000BAY0017' }), 'DE');
  });

  void it('extracts IE from Irish ISIN', () => {
    assert.equal(isinToCountry({ isin: 'IE00B4L5Y983' }), 'IE');
  });

  void it('returns XX for undefined isin', () => {
    assert.equal(isinToCountry({ isin: undefined }), 'XX');
  });

  void it('returns XX for empty string', () => {
    assert.equal(isinToCountry({ isin: '' }), 'XX');
  });

  void it('returns XX for single-char isin', () => {
    assert.equal(isinToCountry({ isin: 'U' }), 'XX');
  });

  void it('uppercases lowercase isin prefix', () => {
    assert.equal(isinToCountry({ isin: 'us0378331005' }), 'US');
  });
});
