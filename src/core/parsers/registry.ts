import type { BrokerId } from '../types.js';
import { ibiDefinition } from './ibi/index.js';
import { ibkrDefinition } from './ibkr/index.js';
import type { ParserDefinition } from './types.js';

/** All registered parser definitions, keyed by BrokerId */
const definitions = new Map<BrokerId, ParserDefinition>(
  [ibkrDefinition, ibiDefinition].map((d) => [d.brokerId, d]),
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
