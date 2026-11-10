// turns a raw snapshot into the numbers a screen shows. pure, so it can be tested.
import { MARINE_ALERT } from './nws';
import { fishingWindows, type Window } from './fishing';
import { moonState, nextSyzygy, daysFromSyzygy, type MoonState } from './moon';
import { assess, type Risk } from './risk';
import { dailyRanges, dayKey, HOUR_MS, levelAt, nextExtremes, trendAt, anomalyFt } from './tide';
import { sunTimes, type SunTimes } from './sun';
import type { Alert } from './alerts';
import type { Extreme } from './noaa';
import type { Snapshot } from './snapshot';

export type Derived = {
  levelNow: number | null;
  levelSource: 'observed' | 'predicted' | null;
  trend: 'rising' | 'falling' | null;
  next: Extreme[];
  anomaly: number | null;
  peakFt: number | null;
  peakAt: number | null;
  risk: Risk;
  moon: MoonState;
  moonDays: Array<{ key: string; date: Date; range: number | null; today: boolean }>;
  peakDay: Date | null;
  growing: boolean | null;
  nextNew: Date;
  nextFull: Date;
  sun: SunTimes | null;
  fishing: Window[];
  marineAlerts: Alert[];
  /** 0 to 1 across today, for the curve's "now" marker */
  curve: Array<{ t: number; ft: number }>;
};

const OBSERVED_FRESH_MS = 45 * 60_000;

export function localDay(now: number): Date {
  const d = new Date(now);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export function derive(s: Snapshot, now: number, timeText: (ms: number) => string): Derived {
  const ext = s.extremes;
  const predicted = levelAt(ext, now);
  const obsFresh = s.observed != null && now - s.observed.t <= OBSERVED_FRESH_MS;
  const levelNow = obsFresh ? s.observed!.value : predicted;
  const anomaly = obsFresh ? anomalyFt(ext, s.observed) : null;

  // peak over the next 12 hours: the tide table plus any positive surge already showing
  let peakFt: number | null = null;
  let peakAt: number | null = null;
  let peakIsNow = false;
  const surge = Math.max(anomaly ?? 0, 0);
  for (const e of ext) {
    if (e.kind !== 'H' || e.t < now || e.t > now + 12 * HOUR_MS) continue;
    const v = e.ft + surge;
    if (peakFt == null || v > peakFt) {
      peakFt = v;
      peakAt = e.t;
    }
  }
  if (obsFresh && s.observed!.value > (peakFt ?? -Infinity)) {
    peakFt = s.observed!.value;
    peakAt = s.observed!.t;
    peakIsNow = true;
  }

  const risk = assess({
    peakFt,
    peakAt,
    peakIsNow,
    levels: s.flood,
    datums: s.datums,
    rain: s.rain?.level ?? null,
    timeText,
  });

  const moon = moonState(new Date(now));
  const today = dayKey(now);
  const ranges = dailyRanges(ext);
  const moonDays: Derived['moonDays'] = [];
  const start = new Date(now);
  start.setHours(12, 0, 0, 0);
  for (let i = -2; i <= 11; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    const key = dayKey(d.getTime());
    moonDays.push({ key, date: d, range: ranges.get(key) ?? null, today: key === today });
  }
  const known = moonDays.filter(d => d.range != null);
  const peak = known.reduce<(typeof known)[number] | null>((b, d) => (b == null || d.range! > b.range! ? d : b), null);
  const todayRange = ranges.get(today) ?? null;
  const laterRanges = known.filter(d => d.date.getTime() > now).map(d => d.range!);
  const growing =
    todayRange != null && laterRanges.length >= 2
      ? laterRanges.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, laterRanges.length) > todayRange
      : // no tide table for the days ahead: spring tides follow new and full moons
        daysFromSyzygy(new Date(now + 3 * 86_400_000)) < daysFromSyzygy(new Date(now));

  const sun = s.where ? sunTimes(localDay(now), s.where) : null;
  const sunEdges: number[] = [];
  if (sun?.sunrise) sunEdges.push(sun.sunrise.getTime(), sun.sunrise.getTime() + 86_400_000);
  if (sun?.sunset) sunEdges.push(sun.sunset.getTime(), sun.sunset.getTime() + 86_400_000);

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const curve: Derived['curve'] = [];
  for (let t = dayStart.getTime(); t <= dayStart.getTime() + 24 * HOUR_MS; t += 15 * 60_000) {
    const ft = levelAt(ext, t);
    if (ft != null) curve.push({ t, ft });
  }

  return {
    levelNow,
    levelSource: levelNow == null ? null : obsFresh ? 'observed' : 'predicted',
    trend: trendAt(ext, now),
    next: nextExtremes(ext, now, 3),
    anomaly,
    peakFt,
    peakAt,
    risk,
    moon,
    moonDays,
    peakDay: peak?.date ?? null,
    growing,
    nextNew: nextSyzygy(new Date(now), 'new'),
    nextFull: nextSyzygy(new Date(now), 'full'),
    sun,
    fishing: fishingWindows(ext, now, 24, sunEdges).slice(0, 3),
    marineAlerts: s.alerts.filter(a => MARINE_ALERT.test(a.event)),
    curve,
  };
}
