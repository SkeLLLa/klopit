/**
 * Standalone Dexie migration helpers.
 *
 * Lives in its own module so unit tests can import without triggering
 * `new KlopitDB()` at top level (which requires `indexedDB`).
 */

/**
 * Minimal session shape the v6 migration sees. Includes the legacy
 * `priorYearLoss` field that used to live directly on `SessionRecord`
 * before it was replaced with a dedicated `priorLosses` table.
 */
export interface LegacySessionRecord {
  id: string;
  priorYearLoss?: number;
}

/**
 * v6 migration helper: drop the legacy single-number `priorYearLoss`
 * field, logging a warning when the value was non-zero so the user knows
 * to re-enter it via the new `/prior-losses` UI.
 *
 * The legacy field was a free-form deduction amount unlinked to the loss
 * year (and uncapped), so it cannot be converted losslessly into the new
 * `PriorYearLoss { year, totalLossPln, alreadyDeductedPln }` shape.
 */
export function stripLegacyPriorYearLoss(session: LegacySessionRecord): void {
  if (session.priorYearLoss === undefined) return;
  if (session.priorYearLoss > 0) {
    console.warn(
      `[klopit] Dropped legacy priorYearLoss=${String(
        session.priorYearLoss,
      )} on session ${session.id}; re-enter via /prior-losses (now requires year + 50% cap per art. 9 ust. 3 updof).`,
    );
  }
  delete session.priorYearLoss;
}
