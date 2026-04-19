import { m } from '$lib/paraglide/messages.js';
import type { SkippedRow } from '../../core/types.js';

export function kindLabel(kind: SkippedRow['kind']): string {
  switch (kind) {
    case 'known-unsupported':
      return m.data_skipped_kind_known_unsupported();
    case 'unknown':
      return m.data_skipped_kind_unknown();
    case 'parse-failure':
      return m.data_skipped_kind_parse_failure();
  }
}
