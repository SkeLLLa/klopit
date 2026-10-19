import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildSymbolCountryMap,
  resolveAdrCountries,
} from '../src/core/tax/symbol-country.js';

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

void describe('buildSymbolCountryMap ADR issuer country', () => {
  const tw = resolveAdrCountries({
    dividends: [{ symbol: 'TSM', adrCountry: 'TW' }],
  }).countries;

  void it('uses the ADR issuer country over the ISIN country', () => {
    const result = buildSymbolCountryMap({
      trades: [{ symbol: 'TSM', isin: 'US8740391003' }],
      dividends: [{ symbol: 'TSM', isin: 'US8740391003' }],
      adrCountries: tw,
    });
    assert.equal(result.get('TSM'), 'TW');
  });

  void it('keeps the ISIN country for an ADR without an issuer country', () => {
    const result = buildSymbolCountryMap({
      trades: [],
      dividends: [{ symbol: 'TSM', isin: 'US8740391003' }],
    });
    assert.equal(result.get('TSM'), 'US');
  });

  void it('lets a user override beat the ADR issuer country', () => {
    const result = buildSymbolCountryMap({
      trades: [],
      dividends: [{ symbol: 'TSM', isin: 'US8740391003' }],
      adrCountries: tw,
      overrides: [{ symbol: 'TSM', country: 'US' }],
    });
    assert.equal(result.get('TSM'), 'US');
  });

  void it('leaves a non-ADR US stock unchanged', () => {
    const result = buildSymbolCountryMap({
      trades: [],
      dividends: [{ symbol: 'AAPL', isin: 'US0378331005' }],
      adrCountries: tw,
    });
    assert.equal(result.get('AAPL'), 'US');
  });
});

void describe('resolveAdrCountries', () => {
  void it('reports conflicting countries instead of picking by order', () => {
    const { countries, conflicts } = resolveAdrCountries({
      dividends: [
        { symbol: 'TSM', adrCountry: 'TW' },
        { symbol: 'TSM', adrCountry: 'US' },
        { symbol: 'ASML', adrCountry: 'NL' },
      ],
    });
    assert.equal(countries.has('TSM'), false);
    assert.deepEqual([...conflicts], ['TSM']);
    assert.equal(countries.get('ASML'), 'NL');
  });

  void it('falls back to the ISIN country for a conflicting symbol', () => {
    const { countries } = resolveAdrCountries({
      dividends: [
        { symbol: 'TSM', adrCountry: 'TW' },
        { symbol: 'TSM', adrCountry: 'JP' },
      ],
    });
    const result = buildSymbolCountryMap({
      trades: [],
      dividends: [{ symbol: 'TSM', isin: 'US8740391003' }],
      adrCountries: countries,
    });
    assert.equal(result.get('TSM'), 'US');
  });

  void it('ignores rows without an ADR country', () => {
    const { countries, conflicts } = resolveAdrCountries({
      dividends: [{ symbol: 'AAPL' }],
    });
    assert.equal(countries.size, 0);
    assert.equal(conflicts.size, 0);
  });
});
