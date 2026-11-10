// stale data stays on screen but is labelled: amber after 30 minutes, and the flood-risk wording
// is grayed out once data is over an hour old.
export type Freshness = 'fresh' | 'aging' | 'stale';

export const AGING_AFTER_MS = 30 * 60_000;
export const STALE_AFTER_MS = 60 * 60_000;

export function freshness(updatedAt: number | null, now: number): Freshness {
  if (updatedAt == null) return 'stale';
  const age = now - updatedAt;
  if (age > STALE_AFTER_MS) return 'stale';
  return age > AGING_AFTER_MS ? 'aging' : 'fresh';
}

export function ageText(updatedAt: number | null, now: number): string {
  if (updatedAt == null) return 'No data yet';
  const min = Math.max(0, Math.round((now - updatedAt) / 60_000));
  if (min < 1) return 'Updated just now';
  if (min < 60) return `Updated ${min} min ago`;
  const h = Math.floor(min / 60);
  return `Updated ${h} hr${h === 1 ? '' : 's'} ago`;
}
