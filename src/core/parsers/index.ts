import { ibiDefinition } from './ibi/index.js';
import { ibkrDefinition } from './ibkr/index.js';
import type { ParserDefinition } from './types.js';

/**
 * All registered parser definitions. Adding a new broker = one new file
 * under `src/core/parsers/<broker>/` and one extra import+entry below.
 * The BrokerId union in `src/core/types.ts` must also gain the new key.
 */
export const ALL_PARSERS: readonly ParserDefinition[] = [
  ibkrDefinition,
  ibiDefinition,
];
