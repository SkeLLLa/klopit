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
