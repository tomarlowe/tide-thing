// NOAA publishes flood thresholds per station but does not say which datum they use. checked against
// Charleston Harbor (8665530): the published NWS minor level is 9.77 and the station's MLLW sits 2.76 above
// its station datum, giving 7.01 ft MLLW, which matches the 7.0 ft the local NWS office uses. so thresholds
// are treated as station-datum values and shifted to MLLW. a sanity guard rejects anything that does not
// look like a flood level, and that case falls back to "higher than usual" with no flood claim.
export type FloodLevelsRaw = {
  nws_minor?: number | null;
  nws_moderate?: number | null;
  nws_major?: number | null;
  nos_minor?: number | null;
  nos_moderate?: number | null;
  nos_major?: number | null;
};

export type Datums = { mllw: number; mhhw: number };

export type FloodLevels = {
  source: 'NWS' | 'NOS';
  /** feet above MLLW */
  minor: number;
  moderate: number;
  major: number;
};

export type FloodCategory = 'none' | 'minor' | 'moderate' | 'major';

function triple(a: unknown, b: unknown, c: unknown): [number, number, number] | null {
  const ok = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0;
  if (!ok(a) || !ok(b) || !ok(c)) return null;
  return a < b && b < c ? [a, b, c] : null;
}

function plausible(levels: [number, number, number], d: Datums): boolean {
  const mhhwAboveMllw = d.mhhw - d.mllw;
  const [minor, , major] = levels;
  // a minor flood level sits near or above the usual high tide, and the whole ladder stays within a few feet
  return minor >= mhhwAboveMllw - 1 && minor <= mhhwAboveMllw + 8 && major - minor <= 8;
}

export function floodLevelsMllw(raw: FloodLevelsRaw | null, d: Datums | null): FloodLevels | null {
  if (!raw || !d) return null;
  const attempts: Array<['NWS' | 'NOS', [number, number, number] | null]> = [
    ['NWS', triple(raw.nws_minor, raw.nws_moderate, raw.nws_major)],
    ['NOS', triple(raw.nos_minor, raw.nos_moderate, raw.nos_major)],
  ];
  for (const [source, t] of attempts) {
    if (!t) continue;
    const shifted: [number, number, number] = [t[0] - d.mllw, t[1] - d.mllw, t[2] - d.mllw];
    if (plausible(shifted, d)) {
      return { source, minor: shifted[0], moderate: shifted[1], major: shifted[2] };
    }
  }
  return null;
}

export function categorize(levelMllw: number, levels: FloodLevels): FloodCategory {
  if (levelMllw >= levels.major) return 'major';
  if (levelMllw >= levels.moderate) return 'moderate';
  if (levelMllw >= levels.minor) return 'minor';
  return 'none';
}

/** how far above the station's usual high tide counts as "higher than usual" when no flood levels exist. */
export const HIGHER_THAN_USUAL_FT = 0.5;

export function higherThanUsual(levelMllw: number, d: Datums): boolean {
  return levelMllw >= d.mhhw - d.mllw + HIGHER_THAN_USUAL_FT;
}
