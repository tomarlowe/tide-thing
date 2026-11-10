// the one-line "flood risk" statement. it is a statement about the tide gauge and the rain outlook,
// never about streets, and the screen says so.
import { categorize, higherThanUsual, type Datums, type FloodCategory, type FloodLevels } from './flood';
import type { RainLevel } from './rain';

export type RiskLevel = 'calm' | 'watch' | 'minor' | 'moderate' | 'major';

export type Risk = {
  level: RiskLevel;
  /** short badge text */
  badge: string;
  /** the one line under the badge */
  line: string;
};

export type RiskInput = {
  /** highest water level in the next 12 hours, feet above MLLW: predicted plus any positive surge */
  peakFt: number | null;
  /** when that peak is expected */
  peakAt: number | null;
  /** the peak is the current gauge reading, already past, not a tide still to come */
  peakIsNow?: boolean;
  levels: FloodLevels | null;
  datums: Datums | null;
  rain: RainLevel | null;
  timeText: (ms: number) => string;
};

const ORDER: FloodCategory[] = ['none', 'minor', 'moderate', 'major'];

function bump(cat: FloodCategory): FloodCategory {
  return ORDER[Math.min(ORDER.indexOf(cat) + 1, ORDER.length - 1)]!;
}

export function assess(i: RiskInput): Risk {
  if (i.peakFt == null || i.peakAt == null) {
    return { level: 'calm', badge: 'NO TIDE DATA', line: 'Waiting for tide data from NOAA.' };
  }
  const at = i.timeText(i.peakAt);
  const ft = i.peakFt.toFixed(1);
  const rainy = i.rain === 'heavy';
  // when the gauge reading itself is the peak, the high tide has already passed
  const peakWords = i.peakIsNow ? `Water is ${ft} ft now` : `High tide ${ft} ft at ${at}`;

  if (i.levels) {
    let cat = categorize(i.peakFt, i.levels);
    // heavy rain on top of a high tide floods low roads sooner, so it lifts the wording one step
    const lifted = rainy && cat !== 'none' ? bump(cat) : cat;
    if (lifted === 'none') {
      const near = i.peakFt >= i.levels.minor - 0.5;
      if (near || rainy) {
        return {
          level: 'watch',
          badge: 'WATCH THE TIDE',
          line: rainy
            ? `Heavy rain expected. ${peakWords}; minor flood level is ${i.levels.minor.toFixed(1)} ft.`
            : `${peakWords}, close to the ${i.levels.minor.toFixed(1)} ft minor flood level.`,
        };
      }
      if (i.peakIsNow) {
        return { level: 'calm', badge: 'NO FLOOD RISK', line: `Water is ${ft} ft now, and the next high tide stays below flood levels.` };
      }
      return { level: 'calm', badge: 'NO FLOOD RISK', line: `Next high tide ${ft} ft at ${at}, below flood levels.` };
    }
    cat = lifted;
    const level = cat as Exclude<FloodCategory, 'none'>;
    const name = level.toUpperCase();
    return {
      level,
      badge: `${name} FLOOD RISK`,
      line: `${i.peakIsNow ? peakWords : `High tide reaches ${ft} ft at ${at}`}. ${level[0]!.toUpperCase()}${level.slice(1)} flood level here is ${i.levels[level].toFixed(1)} ft.${rainy ? ' Heavy rain makes it worse.' : ''}`,
    };
  }

  if (i.datums && higherThanUsual(i.peakFt, i.datums)) {
    return {
      level: 'watch',
      badge: 'HIGHER THAN USUAL',
      line: `${peakWords}, above this station's usual high. NOAA has no flood levels here.${rainy ? ' Heavy rain expected.' : ''}`,
    };
  }
  if (i.peakIsNow) {
    return { level: 'calm', badge: 'NORMAL', line: `Water is ${ft} ft now, about normal. NOAA has no flood levels for this station.` };
  }
  return {
    level: 'calm',
    badge: 'NORMAL',
    line: `Next high tide ${ft} ft at ${at}, about normal. NOAA has no flood levels for this station.`,
  };
}
