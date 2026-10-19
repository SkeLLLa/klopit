/** Counts from the stored tax summary that make the PIT-38 a draft. */
export interface IncompleteCounts {
  missingRateCount?: number;
  missingCostCount?: number;
  inconsistentCarryInCount?: number;
  unassignedOverlapCount?: number;
}

/** True when the results must not be filed. Absent counts (old summaries) are 0. */
export function isTaxFormIncomplete(
  counts: IncompleteCounts | undefined,
): boolean {
  if (!counts) return false;
  return (
    (counts.missingRateCount ?? 0) +
      (counts.missingCostCount ?? 0) +
      (counts.inconsistentCarryInCount ?? 0) +
      (counts.unassignedOverlapCount ?? 0) >
    0
  );
}

export type CopyBlock = 'stale' | 'incomplete' | null;

/**
 * Why PIT-38 values must not be copied. Stale wins: recalculating comes first
 * and may clear "incomplete".
 */
export function copyBlockReason(args: {
  stale: boolean;
  incomplete: boolean;
}): CopyBlock {
  if (args.stale) return 'stale';
  if (args.incomplete) return 'incomplete';
  return null;
}
