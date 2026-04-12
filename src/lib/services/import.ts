import { getParserDefinition } from '../../core/parsers/registry.js';
import type { BrokerId } from '../../core/types.js';
import {
  db,
  type CarryInPositionRecord,
  type CorporateActionRecord,
  type DividendRecord,
  type TradeRecord,
  type WithholdingTaxRecord,
} from '../db.js';
import { addImportedFile } from './session.js';

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
}> {
  const definition = getParserDefinition({ brokerId: args.brokerId });
  const parser = definition.createParser();

  // Feed lines one by one (streaming-compatible)
  const lines = args.text.split('\n');
  for (const line of lines) {
    parser.feed({ line });
  }

  const result = parser.finish();

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

  return {
    broker: definition.brokerName,
    year: result.year,
    tradeCount: result.trades.length,
    dividendCount: result.dividends.length,
  };
}
