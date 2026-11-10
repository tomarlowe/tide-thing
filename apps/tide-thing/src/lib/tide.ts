// tide maths on top of NOAA's high and low predictions. between two extremes the water follows a
// half cosine, which is a close match to the real curve and needs only the hilo list.
import type { Extreme } from './noaa';

export const HOUR_MS = 3_600_000;

export function levelAt(ext: Extreme[], t: number): number | null {
  for (let i = 0; i < ext.length - 1; i++) {
    const a = ext[i]!;
    const b = ext[i + 1]!;
    if (t >= a.t && t <= b.t) {
      const fr = (t - a.t) / (b.t - a.t);
      return b.ft + (a.ft - b.ft) * ((1 + Math.cos(Math.PI * fr)) / 2);
    }
  }
  return null;
}

export function trendAt(ext: Extreme[], t: number): 'rising' | 'falling' | null {
  const next = ext.find(e => e.t > t);
  if (!next) return null;
  return next.kind === 'H' ? 'rising' : 'falling';
}

export function nextExtremes(ext: Extreme[], t: number, count: number): Extreme[] {
  return ext.filter(e => e.t > t).slice(0, count);
}

/** observed minus predicted at the same moment: positive means the water is running above the table. */
export function anomalyFt(ext: Extreme[], observed: { t: number; value: number } | null): number | null {
  if (!observed) return null;
  const p = levelAt(ext, observed.t);
  return p == null ? null : observed.value - p;
}

export type DayKey = string;

export function dayKey(ms: number): DayKey {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** biggest swing between a high and a low within each local calendar day. */
export function dailyRanges(ext: Extreme[]): Map<DayKey, number> {
  const byDay = new Map<DayKey, { hi: number; lo: number }>();
  for (const e of ext) {
    const k = dayKey(e.t);
    const cur = byDay.get(k) ?? { hi: -Infinity, lo: Infinity };
    cur.hi = Math.max(cur.hi, e.ft);
    cur.lo = Math.min(cur.lo, e.ft);
    byDay.set(k, cur);
  }
  const out = new Map<DayKey, number>();
  for (const [k, v] of byDay) if (Number.isFinite(v.hi) && Number.isFinite(v.lo)) out.set(k, v.hi - v.lo);
  return out;
}
