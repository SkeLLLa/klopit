/**
 * Standalone Dexie migration helpers.
 *
 * Lives in its own module so unit tests can import without triggering `new
 * KlopitDB()` at top level (which requires `indexedDB`).
 */

/**
 * Minimal session shape the v6 migration sees. Includes the legacy
 * `priorYearLoss` field that used to live directly on `SessionRecord` before it
 * was replaced with a dedicated `priorLosses` table.
 */
export interface LegacySessionRecord {
  id: string;
  priorYearLoss?: number;
}

/**
 * V6 migration helper: drop the legacy single-number `priorYearLoss` field,
 * logging a warning when the value was non-zero so the user knows to re-enter
 * it via the new `/prior-losses` UI.
 *
 * The legacy field was a free-form deduction amount unlinked to the loss year
 * (and uncapped), so it cannot be converted losslessly into the new
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

/**
 * V9 migration helper: rewrite the legacy broker id 'interactive-brokers' to
 * 'ibkr' on each imported file record. The broker id was shortened when IBI
 * Capital support (broker id 'ibi') was added.
 */
export interface LegacyImportedFileRecord {
  broker: string;
}

export interface SessionWithFiles {
  files?: LegacyImportedFileRecord[];
}

export function renameInteractiveBrokersToIbkr(
  session: SessionWithFiles,
): void {
  if (!session.files) return;
  for (const file of session.files) {
    if (file.broker === 'interactive-brokers') {
      file.broker = 'ibkr';
    }
  }
}

/**
 * V14 migration helpers: carry-in positions gained cost-basis fields and are
 * now matched to sells by ISIN.
 */
export interface LegacyTradeIsinRow {
  sessionId: string;
  symbol: string;
  isin?: string;
}

export interface LegacyCorporateActionIsinRow {
  sessionId: string;
  symbol: string;
  isin?: string;
  targetSymbol?: string;
  targetIsin?: string;
}

export interface LegacyCarryInRow {
  sessionId: string;
  symbol: string;
  isin?: string;
  costBasis?: number;
  costBasisPln?: number;
  costBasisSource?: 'user' | 'zero-confirmed' | 'missing';
}

function sessionSymbolKey(sessionId: string, symbol: string): string {
  return `${sessionId}::${symbol.toUpperCase()}`;
}

/**
 * First non-empty ISIN per (session, upper-cased symbol) from trades, then from
 * corporate actions (source and merger-target sides). A corporate-action ISIN
 * is skipped for a symbol that has trades without an ISIN: those trades are
 * keyed by symbol in FIFO, so the carry-in must be too.
 */
export function buildSessionSymbolIsinMap(
  trades: Iterable<LegacyTradeIsinRow>,
  corporateActions: Iterable<LegacyCorporateActionIsinRow> = [],
): Map<string, string> {
  const map = new Map<string, string>();
  const symbolKeyed = new Set<string>();
  for (const trade of trades) {
    const key = sessionSymbolKey(trade.sessionId, trade.symbol);
    if (!trade.isin) symbolKeyed.add(key);
    else if (!map.has(key)) map.set(key, trade.isin);
  }
  const add = (sessionId: string, symbol?: string, isin?: string) => {
    if (!symbol || !isin) return;
    const key = sessionSymbolKey(sessionId, symbol);
    if (!map.has(key) && !symbolKeyed.has(key)) map.set(key, isin);
  };
  for (const action of corporateActions) {
    add(action.sessionId, action.symbol, action.isin);
    add(action.sessionId, action.targetSymbol, action.targetIsin);
  }
  return map;
}

/**
 * V14: copy a missing ISIN from a same-session trade with the same symbol, and
 * mark rows without any cost as `missing` (old rows were silently treated as
 * cost 0).
 */
export function migrateCarryInPositionV14(
  row: LegacyCarryInRow,
  isinMap: Map<string, string>,
): void {
  if (!row.isin) {
    const isin = isinMap.get(sessionSymbolKey(row.sessionId, row.symbol));
    if (isin) row.isin = isin;
  }
  if (
    row.costBasisSource === undefined &&
    row.costBasis === undefined &&
    row.costBasisPln === undefined
  ) {
    row.costBasisSource = 'missing';
  }
}

/** Row shape the v16 upgrade reads: only the owning session and account. */
export interface LegacyAccountRow {
  sessionId: string;
  account?: string;
}

/**
 * V16 helper: a session needs the per-account FIFO notice when its data comes
 * from more than one broker or securities account.
 */
export function needsPerAccountFifoNotice(args: {
  files: readonly { broker: string }[];
  accounts: readonly string[];
}): boolean {
  const brokers = new Set(args.files.map((f) => f.broker));
  return brokers.size > 1 || new Set(args.accounts).size > 1;
}
