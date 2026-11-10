import { describe, expect, test } from 'bun:test';
import { derive } from './derive';
import { floodLevelsMllw } from './flood';
import { parseActiveStations, parseLatestObs } from './ndbc';
import { alertsUrl, MARINE_ALERT, parseGridUrl, parsePrecip, pointsUrl } from './nws';
import { EMPTY, type Snapshot } from './snapshot';

// shape copied from https://www.ndbc.noaa.gov/data/latest_obs/41004.txt
const LATEST_OBS = `Station 41004
32° 30.1' N  79° 5.9' W

4:00 am EDT
0800 GMT 10/02/26
Wind: SSE (150°), 7.8 kt
Gust: 7.8 kt
Pres: 30.08 falling
Air Temp: 81.9 °F
Water Temp: 81.3 °F
Dew Point: 72.9 °F

Wave Summary
3:40 am EDT
0700 GMT 10/02/26
Swell: 1.6 ft
Period: 8.3 sec
Direction: E
Wind Wave: 1.0 ft
Period: 3.8 sec
Direction: E
`;

describe('buoys', () => {
  test('keeps weather buoys and ignores everything else', () => {
    const xml = `<stations count="3">
<station id="41004" lat="32.501" lon="-79.099" elev="0" name="EDISTO &amp; Offshore" owner="NDBC" pgm="NDBC" type="buoy" met="y" currents="n" waterquality="n" dart="n"/>
<station id="13001" lat="12" lon="-23" elev="0" name="NE Extension" owner="PIRATA" pgm="x" type="buoy" met="n" currents="n" waterquality="n" dart="n"/>
<station id="FPSN7" lat="33.8" lon="-77.6" elev="0" name="Frying Pan" owner="NDBC" pgm="x" type="fixed" met="y" currents="n" waterquality="n" dart="n"/>
</stations>`;
    const list = parseActiveStations(xml);
    expect(list).toEqual([{ id: '41004', name: 'EDISTO & Offshore', lat: 32.501, lon: -79.099 }]);
  });
  test('combines swell and wind waves and reads wind and water temperature', () => {
    const o = parseLatestObs(LATEST_OBS);
    expect(o.waveFt).toBeCloseTo(Math.sqrt(1.6 ** 2 + 1.0 ** 2), 5);
    expect(o.periodSec).toBeCloseTo(8.3);
    expect(o.windKt).toBeCloseTo(7.8);
    expect(o.gustKt).toBeCloseTo(7.8);
    expect(o.waterTempF).toBeCloseTo(81.3);
    expect(o.at).toBe(Date.UTC(2026, 9, 2, 7, 0));
  });
  test('a station with no wave summary reports no waves', () => {
    const o = parseLatestObs(LATEST_OBS.split('Wave Summary')[0]!);
    expect(o.waveFt).toBeNull();
    expect(o.periodSec).toBeNull();
    expect(o.windKt).toBeCloseTo(7.8);
  });
});

describe('weather service', () => {
  test('urls carry coordinates rounded to two decimals', () => {
    expect(alertsUrl({ lat: 32.78, lon: -79.93 })).toBe('https://api.weather.gov/alerts/active?point=32.78,-79.93');
    expect(pointsUrl({ lat: 32.784, lon: -79.926 })).toBe('https://api.weather.gov/points/32.78,-79.93');
  });
  test('only accepts a grid link on the NWS host', () => {
    expect(parseGridUrl({ properties: { forecastGridData: 'https://api.weather.gov/gridpoints/CHS/60,40' } })).toBe(
      'https://api.weather.gov/gridpoints/CHS/60,40',
    );
    expect(parseGridUrl({ properties: { forecastGridData: 'https://evil.example/x' } })).toBeNull();
    expect(parseGridUrl({})).toBeNull();
  });
  test('reads the precipitation series', () => {
    const series = { uom: 'wmoUnit:mm', values: [{ validTime: '2026-11-10T12:00:00+00:00/PT6H', value: 3 }] };
    expect(parsePrecip({ properties: { quantitativePrecipitation: series } })?.values).toHaveLength(1);
    expect(parsePrecip({ properties: {} })).toBeNull();
  });
  test('marine alert matcher', () => {
    expect(MARINE_ALERT.test('Small Craft Advisory')).toBe(true);
    expect(MARINE_ALERT.test('Rip Current Statement')).toBe(true);
    expect(MARINE_ALERT.test('Wind Advisory')).toBe(false);
  });
});

describe('derive', () => {
  const datums = { mllw: 2.76, mhhw: 8.53 };
  const flood = floodLevelsMllw(
    { nws_minor: 9.77, nws_moderate: 10.27, nws_major: 10.77 },
    datums,
  );
  const now = Date.UTC(2026, 10, 10, 15, 0);
  const H = 3_600_000;
  const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
    ...EMPTY,
    where: { lat: 32.78, lon: -79.93 },
    datums,
    flood,
    extremes: [
      { t: now - 3 * H, ft: 0.5, kind: 'L' },
      { t: now + 3 * H, ft: 7.2, kind: 'H' },
      { t: now + 9 * H, ft: 0.6, kind: 'L' },
      { t: now + 15 * H, ft: 6.0, kind: 'H' },
    ],
    ...over,
  });

  test('uses a fresh observation for the level now, and falls back to the table', () => {
    const fresh = derive(snap({ observed: { t: now - 5 * 60_000, value: 3.3 } }), now, () => 'x');
    expect(fresh.levelSource).toBe('observed');
    expect(fresh.levelNow).toBeCloseTo(3.3);
    const old = derive(snap({ observed: { t: now - 3 * H, value: 3.3 } }), now, () => 'x');
    expect(old.levelSource).toBe('predicted');
    expect(old.trend).toBe('rising');
  });
  test('a minor flood risk appears when the coming high passes the minor level', () => {
    const d = derive(snap(), now, () => '6:00 PM');
    expect(d.peakFt).toBeCloseTo(7.2);
    expect(d.risk.level).toBe('minor');
  });
  test('running above the table raises the peak, running below does not lower it', () => {
    const up = derive(snap({ observed: { t: now, value: 4.0 } }), now, () => 'x');
    const base = derive(snap(), now, () => 'x');
    const expected = base.levelNow!;
    expect(up.anomaly).toBeCloseTo(4.0 - expected, 5);
    expect(up.peakFt!).toBeGreaterThan(7.2);
    const down = derive(snap({ observed: { t: now, value: expected - 0.5 } }), now, () => 'x');
    expect(down.peakFt).toBeCloseTo(7.2);
  });
  test('with no tide table the screen still gets a moon and a calm, honest risk', () => {
    const d = derive(snap({ extremes: [] }), now, () => 'x');
    expect(d.risk.badge).toBe('NO TIDE DATA');
    expect(d.moon.name).toBeTruthy();
    expect(d.moonDays).toHaveLength(14);
    expect(d.moonDays.filter(m => m.today)).toHaveLength(1);
  });
  test('marine alerts are picked out of the alert list', () => {
    const alert = (event: string) => ({
      id: event,
      event,
      level: 'other' as const,
      headline: event,
      description: '',
      instruction: '',
      ends: null,
      area: '',
      floodRelated: false,
    });
    const d = derive(snap({ alerts: [alert('Wind Advisory'), alert('Small Craft Advisory')] }), now, () => 'x');
    expect(d.marineAlerts.map(a => a.event)).toEqual(['Small Craft Advisory']);
  });
});
