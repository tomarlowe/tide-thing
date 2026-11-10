import { describe, expect, test } from 'bun:test';
import { levelOf, parseAlerts, spokenText } from './alerts';
import { fishingWindows } from './fishing';
import { categorize, floodLevelsMllw, higherThanUsual } from './flood';
import { distanceMiles, nearest, roundForNetwork } from './geo';
import { daysFromSyzygy, moonAgeDays, moonState, nextSyzygy, SYNODIC_DAYS } from './moon';
import { parseDatums, parseFloodRaw, parseHilo, parseLatest, parseStations, parseWind } from './noaa';
import { parseValidTime, rainInches, rainLevel } from './rain';
import { assess } from './risk';
import { ageText, freshness } from './stale';
import { sunTimes } from './sun';
import { anomalyFt, dailyRanges, levelAt, nextExtremes, trendAt } from './tide';

const DAY = 86_400_000;
// Charleston Harbor, NOAA station 8665530, values read from the live metadata API on 2026-11-10
const CHARLESTON_DATUMS = { mllw: 2.76, mhhw: 8.53 };
const CHARLESTON_FLOOD = {
  nos_minor: 10.4,
  nos_moderate: 11.33,
  nos_major: 12.6,
  nws_minor: 9.77,
  nws_moderate: 10.27,
  nws_major: 10.77,
};

describe('geo', () => {
  test('location is rounded to about 1 km before it leaves the device', () => {
    expect(roundForNetwork({ lat: 32.78081234, lon: -79.92364321 })).toEqual({ lat: 32.78, lon: -79.92 });
  });
  test('distance matches a known pair', () => {
    // by hand: 0.7 deg of latitude is 48.4 mi, 1.16 deg of longitude at 32.4 N is 67.7 mi, so about 83 mi
    const d = distanceMiles({ lat: 32.78, lon: -79.93 }, { lat: 32.08, lon: -81.09 });
    expect(d).toBeGreaterThan(81);
    expect(d).toBeLessThan(85);
  });
  test('nearest picks the closest item', () => {
    const items = [
      { id: 'a', lat: 40, lon: -70 },
      { id: 'b', lat: 33, lon: -80 },
    ];
    expect(nearest({ lat: 32.8, lon: -79.9 }, items)?.item.id).toBe('b');
    expect(nearest({ lat: 0, lon: 0 }, [])).toBeNull();
  });
});

describe('moon', () => {
  test('the reference new moon has age near zero', () => {
    expect(moonAgeDays(new Date(Date.UTC(2000, 0, 6, 18, 14)))).toBeLessThan(0.01);
  });
  test('the December 2025 full moon reads as about half a cycle', () => {
    const age = moonAgeDays(new Date(Date.UTC(2025, 11, 4, 23, 14)));
    expect(Math.abs(age - SYNODIC_DAYS / 2)).toBeLessThan(0.75);
  });
  test('state fields agree with each other', () => {
    const full = moonState(new Date(Date.UTC(2025, 11, 4, 23, 14)));
    expect(full.illumination).toBeGreaterThan(0.97);
    expect(full.name).toBe('Full moon');
    const young = moonState(new Date(Date.UTC(2000, 0, 6, 18, 14) + 3 * DAY));
    expect(young.waxing).toBe(true);
    expect(young.name).toBe('Waxing crescent');
  });
  test('spring tides sit near new and full moon', () => {
    expect(daysFromSyzygy(new Date(Date.UTC(2025, 11, 4, 23, 14)))).toBeLessThan(0.75);
    expect(daysFromSyzygy(new Date(Date.UTC(2000, 0, 6, 18, 14) + 7.4 * DAY))).toBeGreaterThan(6.5);
  });
  test('next full moon lands half a cycle after a new moon', () => {
    const from = new Date(Date.UTC(2000, 0, 6, 19, 0));
    const full = nextSyzygy(from, 'full');
    expect((full.getTime() - from.getTime()) / DAY).toBeCloseTo(SYNODIC_DAYS / 2, 0);
  });
});

describe('sun', () => {
  const charleston = { lat: 32.78, lon: -79.93 };
  test('midsummer day length is about 14 hours at Charleston', () => {
    const t = sunTimes(new Date(Date.UTC(2026, 5, 21)), charleston);
    const hours = (t.sunset!.getTime() - t.sunrise!.getTime()) / 3_600_000;
    expect(hours).toBeGreaterThan(14);
    expect(hours).toBeLessThan(14.6);
  });
  test('equinox day is about 12 hours', () => {
    const t = sunTimes(new Date(Date.UTC(2026, 2, 20)), charleston);
    const hours = (t.sunset!.getTime() - t.sunrise!.getTime()) / 3_600_000;
    expect(hours).toBeGreaterThan(11.9);
    expect(hours).toBeLessThan(12.3);
  });
  test('sunrise is in the early morning local time and sunset after solar noon', () => {
    const t = sunTimes(new Date(Date.UTC(2026, 5, 21)), charleston);
    // EDT is UTC-4, so sunrise should be about 10:20 UTC
    expect(t.sunrise!.getUTCHours()).toBeGreaterThanOrEqual(10);
    expect(t.sunrise!.getUTCHours()).toBeLessThanOrEqual(10);
  });
  test('polar night and midnight sun are reported, not guessed', () => {
    expect(sunTimes(new Date(Date.UTC(2026, 11, 21)), { lat: 80, lon: 0 }).polar).toBe('night');
    expect(sunTimes(new Date(Date.UTC(2026, 5, 21)), { lat: 80, lon: 0 }).polar).toBe('day');
  });
});

describe('flood levels', () => {
  test('Charleston NWS levels shift to the 7.0 / 7.5 / 8.0 ft MLLW the local office uses', () => {
    const lv = floodLevelsMllw(CHARLESTON_FLOOD, CHARLESTON_DATUMS)!;
    expect(lv.source).toBe('NWS');
    expect(lv.minor).toBeCloseTo(7.0, 1);
    expect(lv.moderate).toBeCloseTo(7.5, 1);
    expect(lv.major).toBeCloseTo(8.0, 1);
  });
  test('falls back to NOS levels when NWS has none', () => {
    const lv = floodLevelsMllw({ ...CHARLESTON_FLOOD, nws_minor: null }, CHARLESTON_DATUMS)!;
    expect(lv.source).toBe('NOS');
  });
  test('no levels, missing datums, or nonsense levels give null, never a made-up flood level', () => {
    expect(floodLevelsMllw(null, CHARLESTON_DATUMS)).toBeNull();
    expect(floodLevelsMllw(CHARLESTON_FLOOD, null)).toBeNull();
    expect(floodLevelsMllw({}, CHARLESTON_DATUMS)).toBeNull();
    expect(floodLevelsMllw({ nws_minor: 30, nws_moderate: 31, nws_major: 32 }, CHARLESTON_DATUMS)).toBeNull();
    expect(floodLevelsMllw({ nws_minor: 9, nws_moderate: 8, nws_major: 10 }, CHARLESTON_DATUMS)).toBeNull();
  });
  test('categories split at the thresholds', () => {
    const lv = floodLevelsMllw(CHARLESTON_FLOOD, CHARLESTON_DATUMS)!;
    expect(categorize(6.9, lv)).toBe('none');
    expect(categorize(7.1, lv)).toBe('minor');
    expect(categorize(7.6, lv)).toBe('moderate');
    expect(categorize(8.2, lv)).toBe('major');
  });
  test('higher than usual starts half a foot above the usual high tide', () => {
    expect(higherThanUsual(5.77, CHARLESTON_DATUMS)).toBe(false);
    expect(higherThanUsual(6.3, CHARLESTON_DATUMS)).toBe(true);
  });
});

describe('NOAA parsing', () => {
  test('hilo predictions in GMT', () => {
    const ext = parseHilo({
      predictions: [
        { t: '2026-11-10 08:18', v: '6.256', type: 'H' },
        { t: '2026-11-10 01:52', v: '0.432', type: 'L' },
        { t: 'bad', v: 'x', type: 'H' },
      ],
    });
    expect(ext).toHaveLength(2);
    expect(ext[0]).toEqual({ t: Date.UTC(2026, 10, 10, 1, 52), ft: 0.432, kind: 'L' });
  });
  test('latest reading skips blanks', () => {
    const r = parseLatest({ data: [{ t: '2026-11-10 06:48', v: '' }, { t: '2026-11-10 06:54', v: '0.687' }] });
    expect(r?.value).toBeCloseTo(0.687);
    expect(parseLatest({ error: { message: 'no data' } })).toBeNull();
  });
  test('wind with and without gust', () => {
    const w = parseWind({ data: [{ t: '2026-11-10 06:54', s: '4.67', d: '267.0', dr: 'W', g: '5.64' }] })!;
    expect(w.knots).toBeCloseTo(4.67);
    expect(w.gustKnots).toBeCloseTo(5.64);
    expect(w.compass).toBe('W');
    expect(parseWind({ data: [{ t: '2026-11-10 06:54', s: '3', d: '', dr: '', g: '' }] })!.gustKnots).toBeNull();
  });
  test('datums, flood levels and stations', () => {
    expect(parseDatums({ datums: [{ name: 'MLLW', value: 2.76 }, { name: 'MHHW', value: 8.53 }] })).toEqual(
      CHARLESTON_DATUMS,
    );
    expect(parseDatums({ datums: [{ name: 'MLLW', value: 2.76 }] })).toBeNull();
    expect(parseFloodRaw({ nws_minor: 9.77, nws_moderate: null, self: 'x' })?.nws_minor).toBe(9.77);
    const s = parseStations({ stations: [{ id: '8665530', name: 'Charleston', state: 'SC', lat: 32.78, lng: -79.92 }, { id: 'x' }] });
    expect(s).toHaveLength(1);
    expect(s[0]!.lon).toBe(-79.92);
  });
});

describe('tide maths', () => {
  const ext = parseHilo({
    predictions: [
      { t: '2026-11-10 00:00', v: '0.0', type: 'L' },
      { t: '2026-11-10 06:00', v: '6.0', type: 'H' },
      { t: '2026-11-10 12:00', v: '0.0', type: 'L' },
      { t: '2026-11-11 00:00', v: '5.0', type: 'H' },
    ],
  });
  const at = (h: number) => Date.UTC(2026, 10, 10, h);
  test('curve passes through extremes and is halfway between them', () => {
    expect(levelAt(ext, at(6))).toBeCloseTo(6);
    expect(levelAt(ext, at(3))).toBeCloseTo(3);
    expect(levelAt(ext, at(30))).toBeNull();
  });
  test('trend, next extremes and anomaly', () => {
    expect(trendAt(ext, at(3))).toBe('rising');
    expect(trendAt(ext, at(9))).toBe('falling');
    expect(nextExtremes(ext, at(7), 2).map(e => e.kind)).toEqual(['L', 'H']);
    expect(anomalyFt(ext, { t: at(3), value: 3.5 })).toBeCloseTo(0.5);
    expect(anomalyFt(ext, null)).toBeNull();
  });
  test('daily range is high minus low for each day', () => {
    const ranges = [...dailyRanges(ext).values()];
    expect(ranges.some(r => Math.abs(r - 6) < 0.01)).toBe(true);
  });
});

describe('rain', () => {
  test('parses interval durations', () => {
    expect(parseValidTime('2026-11-10T12:00:00+00:00/PT6H')).toEqual({
      start: Date.UTC(2026, 10, 10, 12),
      end: Date.UTC(2026, 10, 10, 18),
    });
    expect(parseValidTime('nonsense')).toBeNull();
  });
  test('spreads each interval evenly across the window', () => {
    const series = {
      values: [
        { validTime: '2026-11-10T12:00:00+00:00/PT6H', value: 12.7 },
        { validTime: '2026-11-10T18:00:00+00:00/PT6H', value: 25.4 },
      ],
    };
    // window 15:00 to 21:00 takes half of the first interval (6.35 mm) and half of the second (12.7 mm)
    const inches = rainInches(series, new Date(Date.UTC(2026, 10, 10, 15)), 6)!;
    expect(inches).toBeCloseTo((6.35 + 12.7) / 25.4, 3);
    expect(rainInches(series, new Date(Date.UTC(2027, 0, 1)), 6)).toBeNull();
    expect(rainInches(null, new Date(), 6)).toBeNull();
  });
  test('levels', () => {
    expect(rainLevel(0.01)).toBe('none');
    expect(rainLevel(0.2)).toBe('light');
    expect(rainLevel(0.6)).toBe('heavy');
  });
});

describe('alerts', () => {
  const now = new Date('2026-11-10T12:00:00Z');
  const feature = (event: string, extra: Record<string, unknown> = {}) => ({
    properties: { id: event, event, status: 'Actual', messageType: 'Alert', ends: '2026-11-10T20:00:00Z', ...extra },
  });
  test('warnings are red level, everything else amber', () => {
    expect(levelOf('Coastal Flood Warning')).toBe('warning');
    expect(levelOf('Coastal Flood Advisory')).toBe('other');
    expect(levelOf('Tornado Watch')).toBe('other');
  });
  test('drops expired, cancelled and test alerts, and sorts warnings first', () => {
    const alerts = parseAlerts(
      {
        features: [
          feature('Wind Advisory'),
          feature('Coastal Flood Warning'),
          feature('Dense Fog Advisory', { ends: '2026-11-10T11:00:00Z' }),
          feature('Flood Watch', { messageType: 'Cancel' }),
          feature('Test Alert', { status: 'Test' }),
        ],
      },
      now,
    );
    expect(alerts.map(a => a.event)).toEqual(['Coastal Flood Warning', 'Wind Advisory']);
    expect(alerts[0]!.floodRelated).toBe(true);
  });
  test('bad input gives an empty list', () => {
    expect(parseAlerts(null, now)).toEqual([]);
    expect(parseAlerts({ features: 'x' }, now)).toEqual([]);
  });
  test('spoken line is short', () => {
    const [a] = parseAlerts({ features: [feature('Coastal Flood Warning')] }, now);
    expect(spokenText(a!, '3:00 PM')).toBe('Coastal Flood Warning until 3:00 PM.');
    expect(spokenText(a!, null)).toBe('Coastal Flood Warning.');
  });
});

describe('flood risk wording', () => {
  const levels = floodLevelsMllw(CHARLESTON_FLOOD, CHARLESTON_DATUMS)!;
  const base = { levels, datums: CHARLESTON_DATUMS, rain: 'none' as const, peakAt: 1, timeText: () => '9:48 PM' };
  test('minor flood risk when the peak passes the minor level', () => {
    const r = assess({ ...base, peakFt: 7.2 });
    expect(r.level).toBe('minor');
    expect(r.line).toContain('9:48 PM');
  });
  test('calm when well below, watch when close', () => {
    expect(assess({ ...base, peakFt: 5.0 }).level).toBe('calm');
    expect(assess({ ...base, peakFt: 6.7 }).level).toBe('watch');
  });
  test('heavy rain lifts the wording one step', () => {
    expect(assess({ ...base, peakFt: 7.2, rain: 'heavy' }).level).toBe('moderate');
    expect(assess({ ...base, peakFt: 5.0, rain: 'heavy' }).level).toBe('watch');
  });
  test('stations without flood levels never say flood', () => {
    const noLevels = { ...base, levels: null };
    const high = assess({ ...noLevels, peakFt: 7.0 });
    expect(high.badge).toBe('HIGHER THAN USUAL');
    expect(JSON.stringify(high).toLowerCase()).not.toMatch(/flood risk/);
    expect(assess({ ...noLevels, peakFt: 5.5 }).badge).toBe('NORMAL');
  });
  test('missing tide data is stated plainly', () => {
    expect(assess({ ...base, peakFt: null, peakAt: null }).badge).toBe('NO TIDE DATA');
  });
});

describe('freshness and fishing', () => {
  const now = Date.UTC(2026, 10, 10, 12);
  test('fresh, aging and stale', () => {
    expect(freshness(now - 5 * 60_000, now)).toBe('fresh');
    expect(freshness(now - 45 * 60_000, now)).toBe('aging');
    expect(freshness(now - 90 * 60_000, now)).toBe('stale');
    expect(freshness(null, now)).toBe('stale');
    expect(ageText(now - 42 * 60_000, now)).toBe('Updated 42 min ago');
    expect(ageText(null, now)).toBe('No data yet');
  });
  test('turns near sunrise or sunset rank first', () => {
    const ext = [
      { t: now + 2 * 3_600_000, ft: 5, kind: 'H' as const },
      { t: now + 8 * 3_600_000, ft: 1, kind: 'L' as const },
    ];
    const w = fishingWindows(ext, now, 24, [now + 8 * 3_600_000]);
    expect(w[0]!.turn.kind).toBe('L');
    expect(w[0]!.nearSunEdge).toBe(true);
    expect(w).toHaveLength(2);
  });
});
