// mean lunar cycle from a known new moon. the true moon runs up to about half a day ahead or behind
// this, which is fine for a phase picture and a "biggest tides around" label, not for astronomy.
export const SYNODIC_DAYS = 29.530588853;
const EPOCH_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const DAY_MS = 86_400_000;

export type MoonName =
  | 'New moon'
  | 'Waxing crescent'
  | 'First quarter'
  | 'Waxing gibbous'
  | 'Full moon'
  | 'Waning gibbous'
  | 'Last quarter'
  | 'Waning crescent';

export type MoonState = {
  ageDays: number;
  /** 0 at new moon, 0.5 at full, back to 1 */
  cycle: number;
  /** lit fraction 0..1 */
  illumination: number;
  waxing: boolean;
  name: MoonName;
};

export function moonAgeDays(at: Date): number {
  const days = (at.getTime() - EPOCH_NEW_MOON_MS) / DAY_MS;
  return ((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS;
}

export function illuminationAt(cycle: number): number {
  return (1 - Math.cos(2 * Math.PI * cycle)) / 2;
}

export function nameAt(cycle: number): MoonName {
  if (cycle < 0.03 || cycle > 0.97) return 'New moon';
  if (cycle < 0.22) return 'Waxing crescent';
  if (cycle < 0.28) return 'First quarter';
  if (cycle < 0.47) return 'Waxing gibbous';
  if (cycle < 0.53) return 'Full moon';
  if (cycle < 0.72) return 'Waning gibbous';
  if (cycle < 0.78) return 'Last quarter';
  return 'Waning crescent';
}

export function moonState(at: Date): MoonState {
  const ageDays = moonAgeDays(at);
  const cycle = ageDays / SYNODIC_DAYS;
  return { ageDays, cycle, illumination: illuminationAt(cycle), waxing: cycle < 0.5, name: nameAt(cycle) };
}

/** distance from the nearest new or full moon, in days. spring tides sit near zero. */
export function daysFromSyzygy(at: Date): number {
  const half = SYNODIC_DAYS / 2;
  const a = moonAgeDays(at) % half;
  return Math.min(a, half - a);
}

/** next new (0) or full (0.5) moon after `from`. */
export function nextSyzygy(from: Date, kind: 'new' | 'full'): Date {
  const target = kind === 'new' ? 0 : SYNODIC_DAYS / 2;
  let delta = target - moonAgeDays(from);
  if (delta <= 0) delta += SYNODIC_DAYS;
  return new Date(from.getTime() + delta * DAY_MS);
}
