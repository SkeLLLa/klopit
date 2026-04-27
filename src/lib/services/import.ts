import { getParserDefinition } from '../../core/parsers/registry.js';
import type {
  BrokerId,
  ImportWarning,
  ParsedStatement,
  SkippedRow,
} from '../../core/types.js';
import {
  db,
  type CarryInPositionRecord,
  type CorporateActionRecord,
  type CreditInterestRecord,
  type DividendRecord,
  type TradeRecord,
  type TransactionFeeRecord,
  type WithholdingTaxRecord,
} from '../db.js';
import { addImportedFile, appendImportWarnings } from './session.js';

export interface ImportFileArgs {
  sessionId: string;
  brokerId: BrokerId;
  fileName: string;
  fileSize: number;
  file: File;
}

/** Import a broker CSV file into a session */
export async function importFile(args: ImportFileArgs): Promise<{
  broker: string;
  year: number;
  tradeCount: number;
  dividendCount: number;
  creditInterestCount: number;
  warnings: ImportWarning[];
  skippedRows: SkippedRow[];
}> {
  const definition = getParserDefinition({ brokerId: args.brokerId });
  const result: ParsedStatement = await runParser({
    definition,
    file: args.file,
  });
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

  const creditInterests: CreditInterestRecord[] = result.creditInterests.map(
    (interest) => ({
      ...interest,
      sessionId: args.sessionId,
    }),
  );

  const transactionFees: TransactionFeeRecord[] = result.transactionFees.map(
    (fee) => ({
      ...fee,
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
      db.creditInterests,
      db.withholdingTaxes,
      db.transactionFees,
      db.corporateActions,
      db.carryInPositions,
    ],
    async () => {
      await db.trades.bulkAdd(trades);
      await db.dividends.bulkAdd(dividends);
      await db.creditInterests.bulkAdd(creditInterests);
      await db.withholdingTaxes.bulkAdd(withholdingTaxes);
      await db.transactionFees.bulkAdd(transactionFees);
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

  if (result.brokerCountry) {
    await db.sessions.update(args.sessionId, {
      brokerCountry: result.brokerCountry,
      updatedAt: new Date(),
    });
  }

  await appendImportWarnings({ sessionId: args.sessionId, warnings });

  return {
    broker: definition.brokerName,
    year: result.year,
    tradeCount: result.trades.length,
    dividendCount: result.dividends.length,
    creditInterestCount: result.creditInterests.length,
    warnings,
    skippedRows: result.skippedRows,
  };
}

async function runParser(args: {
  definition: ReturnType<typeof getParserDefinition>;
  file: File;
}): Promise<ParsedStatement> {
  if (args.definition.kind === 'csv') {
    const text = await args.file.text();
    const parser = args.definition.createParser();
    for (const line of text.split('\n')) {
      parser.feed({ line });
    }
    return parser.finish();
  }
  const buffer = await args.file.arrayBuffer();
  return args.definition.parse({ buffer });
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
      return `${args.section}: ${count} rows skipped (section not yet supported)`;
    case 'unknown':
      return `Unknown section '${args.section}': ${count} rows skipped`;
    case 'parse-failure':
      return `${args.section}: ${count} rows failed to parse`;
  }
}
