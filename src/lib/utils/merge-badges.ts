export interface WarningBadge {
  badge: string;
  title: string;
  description: string;
}

/**
 * One badge per badge text, so a keyed `{#each}` never sees a duplicate key.
 * Several warnings of one kind list all their descriptions (and so their dates)
 * on separate lines.
 */
export function mergeBadges(args: {
  badges: readonly WarningBadge[];
}): WarningBadge[] {
  const merged = new Map<string, WarningBadge>();
  for (const badge of args.badges) {
    const existing = merged.get(badge.badge);
    if (existing) existing.description += `\n${badge.description}`;
    else merged.set(badge.badge, { ...badge });
  }
  return [...merged.values()];
}
