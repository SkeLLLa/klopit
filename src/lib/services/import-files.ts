import type {
  BrokerId,
  ImportWarning,
  SellToCoverDetail,
  SkippedRow,
} from '../../core/types.js';

import { m } from '#lib/paraglide/messages.js';
import { importFile } from '#lib/services/import.js';

export interface ImportFileResult {
  fileName: string;
  success: boolean;
  message: string;
  warnings: ImportWarning[];
  skippedRows: SkippedRow[];
  incentiveSymbolsMissingRegime: string[];
  sellToCover: SellToCoverDetail[];
}

export async function importFiles(args: {
  sessionId: string;
  brokerId: BrokerId;
  files: FileList;
}): Promise<ImportFileResult[]> {
  const { sessionId, brokerId, files } = args;
  const results: ImportFileResult[] = [];

  for (const file of files) {
    try {
      // Files are imported one at a time: each import read-modify-writes the session record.
      // oxlint-disable-next-line eslint/no-await-in-loop
      const result = await importFile({
        sessionId,
        brokerId,
        fileName: file.name,
        fileSize: file.size,
        file,
      });
      results.push({
        fileName: file.name,
        success: true,
        message: m.data_import_success({
          tradeCount: String(result.tradeCount),
          dividendCount: String(result.dividendCount),
          fileName: file.name,
        }),
        warnings: result.warnings,
        skippedRows: result.skippedRows,
        incentiveSymbolsMissingRegime: result.incentiveSymbolsMissingRegime,
        sellToCover: result.sellToCover,
      });
    } catch (err) {
      results.push({
        fileName: file.name,
        success: false,
        message: m.data_import_error({
          fileName: file.name,
          error: err instanceof Error ? err.message : String(err),
        }),
        warnings: [],
        skippedRows: [],
        incentiveSymbolsMissingRegime: [],
        sellToCover: [],
      });
    }
  }

  return results;
}
