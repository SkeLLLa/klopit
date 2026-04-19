import { BrokerId, type ParsedStatement } from '../../types.js';
import type { PdfParserDefinition } from '../types.js';
import { parseIbiEsppText } from './espp.js';
import { extractPdfText } from './pdf-extract.js';
import { parseIbiRsuText } from './rsu.js';

export { parseLongDate, parseAmount } from './shared.js';

const RSU_TITLE_RE = /Sale of Trustee Shares Activity Statement/i;

/**
 * Dispatcher for IBI PDFs. RSU-titled statements route to the RSU
 * parser; everything else (including the ESPP statement title, and
 * test fixtures that omit the title line) routes to the ESPP parser,
 * which fail-louds on missing fields.
 */
export function parseIbiText(args: { text: string }): ParsedStatement {
  if (RSU_TITLE_RE.test(args.text)) {
    return parseIbiRsuText({ text: args.text });
  }
  return parseIbiEsppText({ text: args.text });
}

export const ibiDefinition: PdfParserDefinition = {
  kind: 'pdf',
  brokerId: BrokerId.IbiCapital,
  brokerName: 'IBI Capital',
  fileExtensions: ['.pdf'],
  async parse(args: { buffer: ArrayBuffer }): Promise<ParsedStatement> {
    const text = await extractPdfText({ buffer: args.buffer });
    return parseIbiText({ text });
  },
};
