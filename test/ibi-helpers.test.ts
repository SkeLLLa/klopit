import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseAmount, parseLongDate } from '../src/core/parsers/ibi/index.js';

void describe('parseLongDate', () => {
  void it('parses "August 31, 2025" (IBI long date format)', () => {
    const d = parseLongDate('August 31, 2025');
    assert.ok(d, 'expected Date');
    assert.equal(d.getFullYear(), 2025);
    assert.equal(d.getMonth(), 7);
    assert.equal(d.getDate(), 31);
  });

  void it('is case-insensitive on month name', () => {
    const d = parseLongDate('MARCH 5, 2024');
    assert.ok(d);
    assert.equal(d.getMonth(), 2);
    assert.equal(d.getDate(), 5);
  });

  void it('handles single-digit day "April 1, 2024"', () => {
    const d = parseLongDate('April 1, 2024');
    assert.ok(d);
    assert.equal(d.getMonth(), 3);
    assert.equal(d.getDate(), 1);
  });

  void it('trims surrounding whitespace', () => {
    const d = parseLongDate('  June 15, 2023  ');
    assert.ok(d);
    assert.equal(d.getMonth(), 5);
  });

  void it('returns undefined for empty string', () => {
    assert.equal(parseLongDate(''), undefined);
  });

  void it('returns undefined for unknown month name', () => {
    assert.equal(parseLongDate('Smarch 1, 2024'), undefined);
  });

  void it('returns undefined for malformed input', () => {
    assert.equal(parseLongDate('not a date'), undefined);
  });

  void it('returns undefined for ISO format (wrong format)', () => {
    assert.equal(parseLongDate('2024-03-15'), undefined);
  });
});

void describe('parseAmount', () => {
  void it('parses "1,234.56" (thousands separator)', () => {
    assert.equal(parseAmount('1,234.56'), 1234.56);
  });

  void it('parses "6,191.91"', () => {
    assert.equal(parseAmount('6,191.91'), 6191.91);
  });

  void it('parses bare number "0"', () => {
    assert.equal(parseAmount('0'), 0);
  });

  void it('parses bare integer "100"', () => {
    assert.equal(parseAmount('100'), 100);
  });

  void it('parses negative "-100.00"', () => {
    assert.equal(parseAmount('-100.00'), -100);
  });

  void it('returns NaN for non-numeric input', () => {
    assert.ok(Number.isNaN(parseAmount('abc')));
  });
});
