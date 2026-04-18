import type { BrokerId, ParsedStatement } from '../types.js';

/** Stateful parser — feed lines one at a time, then call finish() */
export interface StatementParser {
  feed(args: { line: string }): void;
  finish(): ParsedStatement;
}

interface ParserDefinitionBase {
  readonly brokerId: BrokerId;
  readonly brokerName: string;
  /** File extensions accepted by this parser, e.g. ['.csv'] or ['.pdf']. */
  readonly fileExtensions: readonly string[];
}

/** CSV parser — fed lines from a plain-text file. */
export interface CsvParserDefinition extends ParserDefinitionBase {
  readonly kind: 'csv';
  createParser(): StatementParser;
}

/** PDF parser — consumes raw bytes and returns a statement asynchronously. */
export interface PdfParserDefinition extends ParserDefinitionBase {
  readonly kind: 'pdf';
  parse(args: { buffer: ArrayBuffer }): Promise<ParsedStatement>;
}

export type ParserDefinition = CsvParserDefinition | PdfParserDefinition;
