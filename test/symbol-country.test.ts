import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSymbolCountryMap } from '../src/core/tax/symbol-country.js';

void describe('buildSymbolCountryMap', () => {
  void it('uses dividend ISIN to fill country for the same symbol when trade ISIN is missing', () => {
    const result = buildSymbolCountryMap({
      trades: [{ symbol: 'AAPL' }],
      dividends: [{ symbol: 'AAPL', isin: 'US0378331005' }],
    });

    assert.equal(result.get('AAPL'), 'US');
  });

  void it('uses dividend ISIN to upgrade an unknown trade-country detection', () => {
    const result = buildSymbolCountryMap({
      trades: [{ symbol: 'AAPL', isin: 'X' }],
      dividends: [{ symbol: 'AAPL', isin: 'US0378331005' }],
    });

    assert.equal(result.get('AAPL'), 'US');
  });

  void it('keeps manual overrides at highest priority', () => {
    const result = buildSymbolCountryMap({
      trades: [{ symbol: 'AAPL', isin: 'US0378331005' }],
      dividends: [{ symbol: 'AAPL', isin: 'US0378331005' }],
      overrides: [{ symbol: 'AAPL', country: 'IE' }],
    });

    assert.equal(result.get('AAPL'), 'IE');
  });
});
