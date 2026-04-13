import Dexie from 'dexie';
import type { KlopitDB } from './db.js';

interface HasSessionId {
  sessionId?: string;
}

/**
 * Schedule a sessions.dataUpdatedAt bump for after the active transaction
 * commits. Using `on('complete')` avoids requiring callers to widen their
 * rw-transaction scope to include the `sessions` table.
 */
function scheduleStaleBump(db: KlopitDB, sessionId: string | undefined): void {
  if (!sessionId) return;
  const trans = Dexie.currentTransaction;
  const fire = (): void => {
    void db.sessions.update(sessionId, { dataUpdatedAt: new Date() });
  };
  if (trans) {
    trans.on('complete', fire);
  } else {
    queueMicrotask(fire);
  }
}

/**
 * Register table-level hooks on every "source" table so any create / update /
 * delete bumps the owning session's `dataUpdatedAt`. Derived tables
 * (`tradeResults`, `dividendResults`, `taxSummaries`) are NOT hooked —
 * writing them is part of recalculation and must not mark the session as
 * stale.
 */
export function installStaleHooks(db: KlopitDB): void {
  const sourceTables = [
    db.trades,
    db.dividends,
    db.withholdingTaxes,
    db.carryInPositions,
    db.corporateActions,
    db.symbolCountryOverrides,
  ];

  for (const table of sourceTables) {
    table.hook('creating', function (_primKey, obj: HasSessionId) {
      scheduleStaleBump(db, obj.sessionId);
    });

    table.hook(
      'updating',
      function (modifications: HasSessionId, _primKey, obj: HasSessionId) {
        scheduleStaleBump(db, modifications.sessionId ?? obj.sessionId);
      },
    );

    table.hook('deleting', function (_primKey, obj: HasSessionId) {
      scheduleStaleBump(db, obj.sessionId);
    });
  }
}
