// test/stale.test.ts
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { isSessionStale } from '../src/lib/utils/stale.js';

test('isSessionStale returns false when never calculated', () => {
  assert.equal(
    isSessionStale({ calculatedAt: undefined, dataUpdatedAt: new Date() }),
    false,
  );
});

test('isSessionStale returns false when no data update timestamp', () => {
  assert.equal(
    isSessionStale({ calculatedAt: new Date(), dataUpdatedAt: undefined }),
    false,
  );
});

test('isSessionStale returns false when data updated before calc', () => {
  const earlier = new Date('2026-01-01T10:00:00Z');
  const later = new Date('2026-01-01T11:00:00Z');
  assert.equal(
    isSessionStale({ calculatedAt: later, dataUpdatedAt: earlier }),
    false,
  );
});

test('isSessionStale returns false when timestamps are equal', () => {
  const t = new Date('2026-01-01T10:00:00Z');
  assert.equal(isSessionStale({ calculatedAt: t, dataUpdatedAt: t }), false);
});

test('isSessionStale returns true when data updated after calc', () => {
  const earlier = new Date('2026-01-01T10:00:00Z');
  const later = new Date('2026-01-01T11:00:00Z');
  assert.equal(
    isSessionStale({ calculatedAt: earlier, dataUpdatedAt: later }),
    true,
  );
});
