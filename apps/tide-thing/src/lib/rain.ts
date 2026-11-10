// NWS gridpoint data gives liquid precipitation as millimetres over ISO 8601 intervals.
export type PrecipSeries = { uom?: string; values: Array<{ validTime: string; value: number | null }> };

const HOUR_MS = 3_600_000;

function parseDurationMs(iso: string): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(iso);
  if (!m) return 0;
  return ((Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0)) * 60_000;
}

export function parseValidTime(validTime: string): { start: number; end: number } | null {
  const [startIso, dur] = validTime.split('/');
  if (!startIso || !dur) return null;
  const start = Date.parse(startIso);
  const len = parseDurationMs(dur);
  if (!Number.isFinite(start) || len <= 0) return null;
  return { start, end: start + len };
}

/** inches expected between `from` and `from + hours`, spreading each interval's total evenly. */
export function rainInches(series: PrecipSeries | null | undefined, from: Date, hours: number): number | null {
  if (!series || !Array.isArray(series.values)) return null;
  const winStart = from.getTime();
  const winEnd = winStart + hours * HOUR_MS;
  let mm = 0;
  let covered = false;
  for (const v of series.values) {
    if (v.value == null) continue;
    const span = parseValidTime(v.validTime);
    if (!span) continue;
    const overlap = Math.min(span.end, winEnd) - Math.max(span.start, winStart);
    if (overlap <= 0) continue;
    covered = true;
    mm += v.value * (overlap / (span.end - span.start));
  }
  return covered ? mm / 25.4 : null;
}

export type RainLevel = 'none' | 'light' | 'heavy';

export const RAIN_NONE_BELOW_IN = 0.05;
export const RAIN_HEAVY_FROM_IN = 0.5;

export function rainLevel(inches: number): RainLevel {
  if (inches < RAIN_NONE_BELOW_IN) return 'none';
  return inches >= RAIN_HEAVY_FROM_IN ? 'heavy' : 'light';
}
