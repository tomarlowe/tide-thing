// "best fishing times" is a rule of thumb, not NOAA data. many anglers favour the hour either side of a
// tide turning, and the turns that fall near sunrise or sunset rank highest. the screen says so.
import type { Extreme } from './noaa';

const HOUR_MS = 3_600_000;

export type Window = { start: number; end: number; turn: Extreme; nearSunEdge: boolean };

export function fishingWindows(
  ext: Extreme[],
  now: number,
  horizonHours: number,
  sunEdges: number[],
): Window[] {
  const out: Window[] = [];
  for (const turn of ext) {
    if (turn.t + HOUR_MS < now || turn.t > now + horizonHours * HOUR_MS) continue;
    const near = sunEdges.some(s => Math.abs(s - turn.t) <= 1.5 * HOUR_MS);
    out.push({ start: turn.t - HOUR_MS, end: turn.t + HOUR_MS, turn, nearSunEdge: near });
  }
  return out.sort((a, b) => Number(b.nearSunEdge) - Number(a.nearSunEdge) || a.start - b.start);
}
