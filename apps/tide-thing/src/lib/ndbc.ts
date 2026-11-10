// NOAA National Data Buoy Center. the active station list is cached for a month and the small
// "latest observation" file is read at most every half hour, as the NDBC web data guide asks.
import type { LatLon } from './geo';

export type Buoy = { id: string; name: string; lat: number; lon: number };

export const ACTIVE_STATIONS_URL = 'https://www.ndbc.noaa.gov/activestations.xml';

export function latestObsUrl(id: string): string {
  return `https://www.ndbc.noaa.gov/data/latest_obs/${encodeURIComponent(id)}.txt`;
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(tag);
  return m ? m[1]! : null;
}

function unescapeXml(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

/** buoys that report weather, which is the only kind that can carry wave data. */
export function parseActiveStations(xml: string): Buoy[] {
  const out: Buoy[] = [];
  for (const m of xml.matchAll(/<station\b[^>]*>/g)) {
    const tag = m[0];
    if (attr(tag, 'type') !== 'buoy' || attr(tag, 'met') !== 'y') continue;
    const id = attr(tag, 'id');
    const lat = Number(attr(tag, 'lat'));
    const lon = Number(attr(tag, 'lon'));
    if (!id || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({ id, name: unescapeXml(attr(tag, 'name') ?? id), lat, lon });
  }
  return out;
}

export type BuoyObs = {
  /** ms epoch of the wave summary, or of the main observation when there is no wave summary */
  at: number | null;
  waveFt: number | null;
  periodSec: number | null;
  windKt: number | null;
  gustKt: number | null;
  waterTempF: number | null;
};

function num(text: string, label: RegExp): number | null {
  const m = label.exec(text);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
}

function gmtStamp(text: string): number | null {
  // lines like "0700 GMT 10/02/26"
  const m = /(\d{2})(\d{2}) GMT (\d{2})\/(\d{2})\/(\d{2})/.exec(text);
  if (!m) return null;
  return Date.UTC(2000 + Number(m[5]), Number(m[3]) - 1, Number(m[4]), Number(m[1]), Number(m[2]));
}

/**
 * the latest_obs text lists swell and wind-wave heights separately. their energies add, so the combined
 * height is the square root of the sum of squares, the usual way to merge wave components.
 */
export function parseLatestObs(text: string): BuoyObs {
  const [main, waves = ''] = text.split(/Wave Summary/);
  const swell = num(waves, /Swell:\s*([\d.]+)\s*ft/);
  const windWave = num(waves, /Wind Wave:\s*([\d.]+)\s*ft/);
  let waveFt: number | null = null;
  if (swell != null || windWave != null) waveFt = Math.sqrt((swell ?? 0) ** 2 + (windWave ?? 0) ** 2);
  const period = swell != null ? num(waves, /Period:\s*([\d.]+)\s*sec/) : num(waves, /Wind Wave:[^]*?Period:\s*([\d.]+)\s*sec/);
  return {
    at: gmtStamp(waveFt != null ? waves : main!),
    waveFt,
    periodSec: waveFt != null ? period : null,
    windKt: num(main!, /Wind:[^,]*,\s*([\d.]+)\s*kt/),
    gustKt: num(main!, /Gust:\s*([\d.]+)\s*kt/),
    waterTempF: num(main!, /Water Temp:\s*(-?[\d.]+)\s*°F/),
  };
}

export type { LatLon };
