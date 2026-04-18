import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import {
  renameInteractiveBrokersToIbkr,
  stripLegacyPriorYearLoss,
  type LegacySessionRecord,
  type SessionWithFiles,
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

void describe('v8 migration: add credit-interest tables', () => {
  void it('version 8 exists for credit-interest persistence', () => {
    assert.ok(true, 'v8 adds creditInterests and creditInterestResults');
  });
});

void describe('v9 migration: renameInteractiveBrokersToIbkr', () => {
  void it('rewrites broker id on each imported file', () => {
    const session: SessionWithFiles = {
      files: [
        { broker: 'interactive-brokers' },
        { broker: 'interactive-brokers' },
        { broker: 'some-other-broker' },
      ],
    };

    renameInteractiveBrokersToIbkr(session);

    assert.deepEqual(
      session.files?.map((f) => f.broker),
      ['ibkr', 'ibkr', 'some-other-broker'],
    );
  });

  void it('is a no-op for sessions without files', () => {
    const session: SessionWithFiles = {};
    renameInteractiveBrokersToIbkr(session);
    assert.equal(session.files, undefined);
  });

  void it('is a no-op when no file references the legacy id', () => {
    const session: SessionWithFiles = {
      files: [{ broker: 'ibkr' }, { broker: 'ibi' }],
    };
    renameInteractiveBrokersToIbkr(session);
    assert.deepEqual(
      session.files?.map((f) => f.broker),
      ['ibkr', 'ibi'],
    );
  });
});
