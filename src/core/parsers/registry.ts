import type { BrokerId } from '../types.js';
import { ALL_PARSERS } from './index.js';
import type { ParserDefinition } from './types.js';

const definitions: ReadonlyMap<BrokerId, ParserDefinition> = new Map(
  ALL_PARSERS.map((d) => [d.brokerId, d] as const),
);

/** Get parser definition for a specific broker. Throws if unsupported. */
export function getParserDefinition(args: {
  brokerId: BrokerId;
}): ParserDefinition {
  const def = definitions.get(args.brokerId);
  if (!def) {
    throw new Error(`Unsupported broker: ${args.brokerId}`);
  }
  return def;
}

/** Get list of all supported brokers */
export function supportedBrokers(): {
  id: BrokerId;
  name: string;
  fileExtensions: readonly string[];
}[] {
  return [...definitions.values()].map((d) => ({
    id: d.brokerId,
    name: d.brokerName,
    fileExtensions: d.fileExtensions,
  }));
}
