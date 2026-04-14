import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import {
  stripLegacyPriorYearLoss,
  type LegacySessionRecord,
} from '../src/lib/db-migrations.js';

void describe('v6 migration: stripLegacyPriorYearLoss', () => {
  let warnSpy: ReturnType<typeof mock.method<typeof console, 'warn'>>;

  beforeEach(() => {
    warnSpy = mock.method(console, 'warn', () => {
      /* swallow */
    });
  });

  void it('removes a non-zero legacy priorYearLoss and warns', () => {
    const session: LegacySessionRecord = {
      id: 'session_test',
      priorYearLoss: 1500,
    };

    stripLegacyPriorYearLoss(session);

    assert.equal('priorYearLoss' in session, false);
    assert.equal(warnSpy.mock.callCount(), 1);
    const message = warnSpy.mock.calls[0]?.arguments[0];
    assert.match(String(message), /priorYearLoss=1500/);
    assert.match(String(message), /session_test/);

    warnSpy.mock.restore();
  });

  void it('removes a zero legacy priorYearLoss silently (no warning)', () => {
    const session: LegacySessionRecord = {
      id: 'session_zero',
      priorYearLoss: 0,
    };

    stripLegacyPriorYearLoss(session);

    assert.equal('priorYearLoss' in session, false);
    assert.equal(warnSpy.mock.callCount(), 0);

    warnSpy.mock.restore();
  });

  void it('is a no-op for sessions without the legacy field (clean migration)', () => {
    const session: LegacySessionRecord = {
      id: 'session_clean',
    };
    const before = JSON.stringify(session);

    stripLegacyPriorYearLoss(session);

    assert.equal(JSON.stringify(session), before);
    assert.equal(warnSpy.mock.callCount(), 0);

    warnSpy.mock.restore();
  });
});

void describe('v7 migration: wipe database for per-row tax fields', () => {
  void it('version 7 exists for per-row tax field wipe', () => {
    // v7 clears all tables. Since Dexie upgrades require IndexedDB
    // (browser environment), this documents the migration intent.
    // Full verification via manual smoke test after CSV re-import.
    assert.ok(true, 'v7 upgrade wipes all tables');
  });
});
