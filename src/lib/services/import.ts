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
import { isCarryInCostMissing } from './carry-in.js';
import { deriveImportWarnings } from './import-warnings.js';
import { symbolsMissingIncentiveRegime } from './incentive.js';
import { addImportedFile, appendImportWarnings } from './session.js';

export {
  deriveImportWarnings,
  mergeImportWarnings,
} from './import-warnings.js';

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
  /** Symbols whose RSU / ESPP lots in this file have no regime yet. */
  incentiveSymbolsMissingRegime: string[];
  /** Vests where the broker sold or withheld shares for taxes. */
  sellToCoverCount: number;
}> {
  const definition = getParserDefinition({ brokerId: args.brokerId });
  const result: ParsedStatement = await runParser({
    definition,
    file: args.file,
  });
  const warnings = deriveImportWarnings({ skippedRows: result.skippedRows });

  // Parsers without per-account data (IBI, Schwab) get one default account.
  const defaultAccount = `${result.broker}:default`;

  // Store parsed trades
  const trades: TradeRecord[] = result.trades.map((t) => ({
    ...t,
    account: t.account ?? defaultAccount,
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
      account: ca.account ?? defaultAccount,
      sessionId: args.sessionId,
    }),
  );

  // Store carry-in positions. Broker statements carry no acquisition cost,
  // so mark it explicitly as missing; the Data page asks the user for it.
  const carryInPositions: CarryInPositionRecord[] = result.carryInPositions.map(
    (p) => ({
      ...p,
      costBasisSource:
        p.costBasisSource ?? (isCarryInCostMissing(p) ? 'missing' : 'user'),
      account: p.account ?? defaultAccount,
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
    incentiveSymbolsMissingRegime: symbolsMissingIncentiveRegime(result.trades),
    sellToCoverCount: result.warnings.filter((w) => w.kind === 'sell-to-cover')
      .length,
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
