import type { BrokerId, ParsedStatement } from '../types.js';

/** Stateful parser — feed lines one at a time, then call finish() */
export interface StatementParser {
  feed(args: { line: string }): void;
  finish(): ParsedStatement;
}

/** Registry entry — immutable metadata + parser factory */
export interface ParserDefinition {
  readonly brokerId: BrokerId;
  readonly brokerName: string;
  createParser(): StatementParser;
}
