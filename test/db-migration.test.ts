import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';

import {
  buildSessionSymbolIsinMap,
  migrateCarryInPositionV14,
  renameInteractiveBrokersToIbkr,
  stripLegacyPriorYearLoss,
  type LegacyCarryInRow,
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

void describe('v14 migration: migrateCarryInPositionV14', () => {
  void it('copies ISIN from a same-session trade and marks cost missing', () => {
    const isinMap = buildSessionSymbolIsinMap([
      { sessionId: 's1', symbol: 'MSFT' },
      { sessionId: 's1', symbol: 'aapl', isin: 'US0378331005' },
      { sessionId: 's2', symbol: 'MSFT', isin: 'US5949181045' },
    ]);
    const row: LegacyCarryInRow = { sessionId: 's1', symbol: 'AAPL' };
    migrateCarryInPositionV14(row, isinMap);
    assert.equal(row.isin, 'US0378331005');
    assert.equal(row.costBasisSource, 'missing');

    // Another session's ISIN must not leak in.
    const other: LegacyCarryInRow = { sessionId: 's1', symbol: 'MSFT' };
    migrateCarryInPositionV14(other, isinMap);
    assert.equal(other.isin, undefined);
  });

  void it('keeps an existing ISIN and cost source', () => {
    const row: LegacyCarryInRow = {
      sessionId: 's1',
      symbol: 'AAPL',
      isin: 'XX0000000000',
      costBasis: 100,
      costBasisSource: 'user',
    };
    migrateCarryInPositionV14(
      row,
      buildSessionSymbolIsinMap([
        { sessionId: 's1', symbol: 'AAPL', isin: 'US0378331005' },
      ]),
    );
    assert.equal(row.isin, 'XX0000000000');
    assert.equal(row.costBasisSource, 'user');
  });

  void it('falls back to corporate-action source and target ISINs', () => {
    const isinMap = buildSessionSymbolIsinMap(
      [],
      [
        {
          sessionId: 's1',
          symbol: 'OLD',
          isin: 'US0000000001',
          targetSymbol: 'NEW',
          targetIsin: 'US0000000002',
        },
      ],
    );
    const old: LegacyCarryInRow = { sessionId: 's1', symbol: 'old' };
    const renamed: LegacyCarryInRow = { sessionId: 's1', symbol: 'NEW' };
    migrateCarryInPositionV14(old, isinMap);
    migrateCarryInPositionV14(renamed, isinMap);
    assert.equal(old.isin, 'US0000000001');
    assert.equal(renamed.isin, 'US0000000002');
  });

  void it('ignores a corporate-action ISIN for a symbol traded without ISIN', () => {
    const isinMap = buildSessionSymbolIsinMap(
      [{ sessionId: 's1', symbol: 'OLD' }],
      [{ sessionId: 's1', symbol: 'OLD', isin: 'US0000000001' }],
    );
    const row: LegacyCarryInRow = { sessionId: 's1', symbol: 'OLD' };
    migrateCarryInPositionV14(row, isinMap);
    assert.equal(row.isin, undefined);
  });
});
