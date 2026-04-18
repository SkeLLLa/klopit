import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cleanField,
  parseCsvLine,
  parseDateTime,
  parseDecimal,
} from '../src/core/parsers/shared/csv-utils.js';

void describe('parseCsvLine', () => {
  void it('splits simple comma-separated fields', () => {
    assert.deepEqual(parseCsvLine({ line: 'a,b,c' }), ['a', 'b', 'c']);
  });

  void it('handles quoted fields with commas inside', () => {
    assert.deepEqual(parseCsvLine({ line: 'a,"b,c",d' }), ['a', 'b,c', 'd']);
  });

  void it('handles escaped quotes inside quoted fields', () => {
    assert.deepEqual(parseCsvLine({ line: 'a,"b""c",d' }), ['a', 'b"c', 'd']);
  });

  void it('handles empty fields', () => {
    assert.deepEqual(parseCsvLine({ line: 'a,,c' }), ['a', '', 'c']);
  });

  void it('handles trailing comma', () => {
    assert.deepEqual(parseCsvLine({ line: 'a,b,' }), ['a', 'b', '']);
  });

  void it('strips BOM from first field', () => {
    assert.deepEqual(parseCsvLine({ line: '\uFEFFa,b' }), ['a', 'b']);
  });

  void it('handles single field', () => {
    assert.deepEqual(parseCsvLine({ line: 'hello' }), ['hello']);
  });

  void it('handles empty line', () => {
    assert.deepEqual(parseCsvLine({ line: '' }), ['']);
  });

  void it('handles quoted field with newline characters', () => {
    assert.deepEqual(parseCsvLine({ line: '"a\nb",c' }), ['a\nb', 'c']);
  });
});

void describe('cleanField', () => {
  void it('trims whitespace', () => {
    assert.equal(cleanField({ value: '  hello  ' }), 'hello');
  });

  void it('strips surrounding quotes', () => {
    assert.equal(cleanField({ value: '"hello"' }), 'hello');
  });

  void it('trims then strips quotes', () => {
    assert.equal(cleanField({ value: '  "hello"  ' }), 'hello');
  });

  void it('returns empty string for empty input', () => {
    assert.equal(cleanField({ value: '' }), '');
  });
});

void describe('parseDecimal', () => {
  void it('parses regular number', () => {
    assert.equal(parseDecimal({ value: '123.45' }), 123.45);
  });

  void it('parses negative number', () => {
    assert.equal(parseDecimal({ value: '-0.36' }), -0.36);
  });

  void it('parses number with comma thousands separator', () => {
    assert.equal(parseDecimal({ value: '1,234.56' }), 1234.56);
  });

  void it('returns undefined for empty string', () => {
    assert.equal(parseDecimal({ value: '' }), undefined);
  });

  void it('returns undefined for non-numeric string', () => {
    assert.equal(parseDecimal({ value: 'abc' }), undefined);
  });

  void it('parses zero', () => {
    assert.equal(parseDecimal({ value: '0' }), 0);
  });

  void it('handles whitespace around number', () => {
    assert.equal(parseDecimal({ value: ' 42.5 ' }), 42.5);
  });
});

void describe('parseDateTime', () => {
  void it('parses "yyyy-MM-dd, HH:mm:ss" format (IB quoted datetime)', () => {
    const result = parseDateTime({ value: '2024-01-15, 10:30:00' });
    assert.ok(result);
    assert.equal(result.getFullYear(), 2024);
    assert.equal(result.getMonth(), 0); // January
    assert.equal(result.getDate(), 15);
    assert.equal(result.getHours(), 10);
    assert.equal(result.getMinutes(), 30);
    assert.equal(result.getSeconds(), 0);
  });

  void it('parses "yyyy-MM-dd HH:mm:ss" format', () => {
    const result = parseDateTime({ value: '2024-02-20 09:45:00' });
    assert.ok(result);
    assert.equal(result.getFullYear(), 2024);
    assert.equal(result.getMonth(), 1);
    assert.equal(result.getDate(), 20);
  });

  void it('parses "yyyy-MM-dd" date-only format', () => {
    const result = parseDateTime({ value: '2024-03-10' });
    assert.ok(result);
    assert.equal(result.getFullYear(), 2024);
    assert.equal(result.getMonth(), 2);
    assert.equal(result.getDate(), 10);
  });

  void it('returns undefined for invalid date string', () => {
    assert.equal(parseDateTime({ value: 'not-a-date' }), undefined);
  });

  void it('returns undefined for empty string', () => {
    assert.equal(parseDateTime({ value: '' }), undefined);
  });
});
