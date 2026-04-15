import { getParserDefinition } from '../../core/parsers/registry.js';
import type { BrokerId, ImportWarning, SkippedRow } from '../../core/types.js';
import {
  db,
  type CarryInPositionRecord,
  type CorporateActionRecord,
  type DividendRecord,
  type TradeRecord,
  type WithholdingTaxRecord,
} from '../db.js';
import { addImportedFile, appendImportWarnings } from './session.js';

export interface ImportFileArgs {
  sessionId: string;
  brokerId: BrokerId;
  fileName: string;
  fileSize: number;
  text: string;
}

/** Import a broker CSV file into a session */
export async function importFile(args: ImportFileArgs): Promise<{
  broker: string;
  year: number;
  tradeCount: number;
  dividendCount: number;
  warnings: ImportWarning[];
  skippedRows: SkippedRow[];
}> {
  const definition = getParserDefinition({ brokerId: args.brokerId });
  const parser = definition.createParser();

  // Feed lines one by one (streaming-compatible)
  const lines = args.text.split('\n');
  for (const line of lines) {
    parser.feed({ line });
  }

  const result = parser.finish();
  const warnings = deriveImportWarnings({ skippedRows: result.skippedRows });

  // Store parsed trades
  const trades: TradeRecord[] = result.trades.map((t) => ({
    ...t,
    sessionId: args.sessionId,
  }));

  // Store parsed dividends (matched with withholding taxes later)
  const dividends: DividendRecord[] = result.dividends.map((d) => ({
    ...d,
    sessionId: args.sessionId,
    withholdingTax: 0, // matched during calculation
  }));

  // Store withholding taxes
  const withholdingTaxes: WithholdingTaxRecord[] = result.withholdingTaxes.map(
    (wt) => ({
      ...wt,
      sessionId: args.sessionId,
    }),
  );

  // Store corporate actions
  const corporateActions: CorporateActionRecord[] = result.corporateActions.map(
    (ca) => ({
      ...ca,
      sessionId: args.sessionId,
    }),
  );

  // Store carry-in positions
  const carryInPositions: CarryInPositionRecord[] = result.carryInPositions.map(
    (p) => ({
      ...p,
      sessionId: args.sessionId,
    }),
  );

  await db.transaction(
    'rw',
    [
      db.trades,
      db.dividends,
      db.withholdingTaxes,
      db.corporateActions,
      db.carryInPositions,
    ],
    async () => {
      await db.trades.bulkAdd(trades);
      await db.dividends.bulkAdd(dividends);
      await db.withholdingTaxes.bulkAdd(withholdingTaxes);
      await db.corporateActions.bulkAdd(corporateActions);
      await db.carryInPositions.bulkAdd(carryInPositions);
    },
  );

  // Record file metadata in session
  await addImportedFile({
    sessionId: args.sessionId,
    file: {
      name: args.fileName,
      broker: definition.brokerId,
      size: args.fileSize,
      importedAt: new Date(),
    },
  });

  await appendImportWarnings({ sessionId: args.sessionId, warnings });

  return {
    broker: definition.brokerName,
    year: result.year,
    tradeCount: result.trades.length,
    dividendCount: result.dividends.length,
    warnings,
    skippedRows: result.skippedRows,
  };
}

export function deriveImportWarnings(args: {
  skippedRows: SkippedRow[];
}): ImportWarning[] {
  return buildImportWarnings(
    args.skippedRows.map((row) => ({
      section: row.section,
      kind: row.kind,
      rowCount: 1,
    })),
  );
}

/**
 * Merge a list of ImportWarnings, collapsing duplicate (section, kind) entries
 * by summing rowCount and regenerating the message. Used when appending new
 * warnings onto an existing session record so a second file import that
 * produces the same section/kind doesn't create a duplicate entry (which would
 * crash Svelte's keyed each block in the warning banner).
 */
export function mergeImportWarnings(args: {
  warnings: readonly ImportWarning[];
}): ImportWarning[] {
  return buildImportWarnings(
    args.warnings.map((warning) => ({
      section: warning.section,
      kind: warning.kind,
      rowCount: warning.rowCount,
    })),
  );
}

function buildImportWarnings(
  entries: Iterable<{
    section: string;
    kind: SkippedRow['kind'];
    rowCount: number;
  }>,
): ImportWarning[] {
  const groups = new Map<
    string,
    { section: string; kind: SkippedRow['kind']; rowCount: number }
  >();

  for (const entry of entries) {
    const key = `${entry.section}::${entry.kind}`;
    const current = groups.get(key);
    if (current) {
      current.rowCount += entry.rowCount;
    } else {
      groups.set(key, { ...entry });
    }
  }

  return [...groups.values()]
    .sort((a, b) =>
      a.section === b.section
        ? a.kind.localeCompare(b.kind)
        : a.section.localeCompare(b.section),
    )
    .map((group) => ({
      section: group.section,
      kind: group.kind,
      rowCount: group.rowCount,
      message: formatImportWarningMessage(group),
    }));
}

function formatImportWarningMessage(args: {
  section: string;
  kind: SkippedRow['kind'];
  rowCount: number;
}): string {
  const count = String(args.rowCount);
  switch (args.kind) {
    case 'known-unsupported':
      return `${args.section}: ${count} rows skipped (known unsupported section)`;
    case 'unknown':
      return `Unknown section '${args.section}': ${count} rows skipped`;
    case 'parse-failure':
      return `${args.section}: ${count} rows failed to parse`;
  }
}
