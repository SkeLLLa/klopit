import type { ImportWarning, SkippedRow } from '../../core/types.js';

export function deriveImportWarnings(args: {
  skippedRows: SkippedRow[];
}): ImportWarning[] {
  return buildImportWarnings(
    args.skippedRows.map((row) => ({
      section: row.section,
      kind: row.kind,
      rowCount: 1,
    })),
  );
}

/**
 * Merge a list of ImportWarnings, collapsing duplicate (section, kind) entries
 * by summing rowCount and regenerating the message. Used when appending new
 * warnings onto an existing session record so a second file import that
 * produces the same section/kind doesn't create a duplicate entry (which would
 * crash Svelte's keyed each block in the warning banner).
 */
export function mergeImportWarnings(args: {
  warnings: readonly ImportWarning[];
}): ImportWarning[] {
  return buildImportWarnings(
    args.warnings.map((warning) => ({
      section: warning.section,
      kind: warning.kind,
      rowCount: warning.rowCount,
    })),
  );
}

function buildImportWarnings(
  entries: Iterable<{
    section: string;
    kind: SkippedRow['kind'];
    rowCount: number;
  }>,
): ImportWarning[] {
  const groups = new Map<
    string,
    { section: string; kind: SkippedRow['kind']; rowCount: number }
  >();

  for (const entry of entries) {
    const key = `${entry.section}::${entry.kind}`;
    const current = groups.get(key);
    if (current) {
      current.rowCount += entry.rowCount;
    } else {
      groups.set(key, { ...entry });
    }
  }

  return [...groups.values()]
    .toSorted((a, b) =>
      a.section === b.section
        ? a.kind.localeCompare(b.kind)
        : a.section.localeCompare(b.section),
    )
    .map((group) => ({
      section: group.section,
      kind: group.kind,
      rowCount: group.rowCount,
      message: formatImportWarningMessage(group),
    }));
}

const importWarningFormatters: Record<
  SkippedRow['kind'],
  (section: string, count: string) => string
> = {
  'known-unsupported': (section, count) =>
    `${section}: ${count} rows skipped (section not yet supported)`,
  'unknown': (section, count) =>
    `Unknown section '${section}': ${count} rows skipped`,
  'parse-failure': (section, count) =>
    `${section}: ${count} rows failed to parse`,
};

function formatImportWarningMessage(args: {
  section: string;
  kind: SkippedRow['kind'];
  rowCount: number;
}): string {
  // `kind` may come from a warning persisted by another app version.
  if (args.section === 'Transfers' && args.kind === 'known-unsupported') {
    return `${args.rowCount} stock transfers found and skipped — transferred-in shares need their original buy (enter it as a trade or carry-in) (art. 24 ust. 10)`;
  }
  const format = importWarningFormatters[args.kind] as
    | ((section: string, count: string) => string)
    | undefined;
  return format?.(args.section, String(args.rowCount)) ?? '';
}
