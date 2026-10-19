process.env.TZ = 'America/New_York';

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  fromDateInput,
  fromDatetimeLocal,
} from '../src/lib/utils/date-input.js';

void describe('fromDateInput', () => {
  void it('parses as a local date regardless of timezone', () => {
    const d = fromDateInput('2025-01-01');
    assert.ok(d);
    assert.equal(d.getFullYear(), 2025);
    assert.equal(d.getMonth(), 0);
    assert.equal(d.getDate(), 1);
  });

  void it('returns null for invalid input', () => {
    assert.equal(fromDateInput(''), null);
    assert.equal(fromDateInput('garbage'), null);
    assert.equal(fromDateInput('01.01.2025'), null);
    assert.equal(fromDateInput('2025-02-30'), null);
    assert.equal(fromDateInput('2025-13-01'), null);
  });
});

void describe('fromDatetimeLocal', () => {
  void it('keeps local hour and minute', () => {
    const d = fromDatetimeLocal('2025-03-10T14:35');
    assert.ok(d);
    assert.equal(d.getFullYear(), 2025);
    assert.equal(d.getMonth(), 2);
    assert.equal(d.getDate(), 10);
    assert.equal(d.getHours(), 14);
    assert.equal(d.getMinutes(), 35);
  });

  void it('accepts optional seconds', () => {
    const d = fromDatetimeLocal('2025-03-10T14:35:20');
    assert.ok(d);
    assert.equal(d.getSeconds(), 20);
  });

  void it('returns null for invalid input', () => {
    assert.equal(fromDatetimeLocal('2025-03-10'), null);
    assert.equal(fromDatetimeLocal('2025-02-30T10:00'), null);
    assert.equal(fromDatetimeLocal('2025-03-10T25:00'), null);
  });
});
