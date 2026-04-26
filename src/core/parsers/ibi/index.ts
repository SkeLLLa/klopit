import { BrokerId, type ParsedStatement } from '../../types.js';
import type { PdfParserDefinition } from '../types.js';
import { parseIbiConfirmationText } from './confirmation.js';
import { parseIbiEsppText } from './espp.js';
import { extractPdfText } from './pdf-extract.js';
import { parseIbiRsuText } from './rsu.js';

export { parseLongDate, parseLongDateStrict, parseAmount } from './shared.js';
export type { ParsedDate } from './shared.js';

const RSU_TITLE_RE = /Sale of Trustee Shares Activity Statement/i;
const CONFIRMATION_TITLE_RE = /Confirmation of Sale/i;

/**
 * Dispatcher for IBI PDFs. RSU-titled statements route to the RSU
 * parser; "Confirmation of Sale" documents (ESPP quick-sell receipts)
 * route to the Confirmation parser; everything else (including the
 * classic ESPP "Sale Of Stock Activity Statement" title, and test
 * fixtures that omit the title line) routes to the ESPP parser, which
 * fail-louds on missing fields.
 */
export function parseIbiText(args: { text: string }): ParsedStatement {
  if (RSU_TITLE_RE.test(args.text)) {
    return parseIbiRsuText({ text: args.text });
  }
  if (CONFIRMATION_TITLE_RE.test(args.text)) {
    return parseIbiConfirmationText({ text: args.text });
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
