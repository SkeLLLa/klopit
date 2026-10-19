import { m } from '$lib/paraglide/messages.js';

import type { SkippedRow } from '../../core/types.js';

const kindLabels: Record<SkippedRow['kind'], () => string> = {
  'known-unsupported': m.data_skipped_kind_known_unsupported,
  'unknown': m.data_skipped_kind_unknown,
  'parse-failure': m.data_skipped_kind_parse_failure,
};

export function kindLabel(kind: SkippedRow['kind']): string {
  // `kind` may come from a row persisted by another app version.
  const label = kindLabels[kind] as (() => string) | undefined;
  return label?.() ?? '';
}
