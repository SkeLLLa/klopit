// src/lib/utils/stale.ts
export function isSessionStale(args: {
  calculatedAt: Date | undefined;
  dataUpdatedAt: Date | undefined;
}): boolean {
  if (!args.calculatedAt || !args.dataUpdatedAt) return false;
  return args.dataUpdatedAt.getTime() > args.calculatedAt.getTime();
}
