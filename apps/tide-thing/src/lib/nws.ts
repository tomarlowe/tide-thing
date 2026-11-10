// National Weather Service API. no key is needed today, but NWS says one will be required later, so a
// 401 or 403 is reported as "NWS access changed" instead of being treated as "no alerts".
import type { LatLon } from './geo';
import type { PrecipSeries } from './rain';

const BASE = 'https://api.weather.gov';

// NWS asks for a User-Agent that identifies the app; a project link is enough
export const NWS_HEADERS = [
  { name: 'User-Agent', value: '(Tide Thing, https://github.com/tomarlowe/tide-thing)' },
  { name: 'Accept', value: 'application/geo+json' },
];

export function alertsUrl(p: LatLon): string {
  return `${BASE}/alerts/active?point=${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;
}

export function pointsUrl(p: LatLon): string {
  return `${BASE}/points/${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;
}

export function parseGridUrl(json: unknown): string | null {
  const url = (json as { properties?: { forecastGridData?: unknown } } | null)?.properties?.forecastGridData;
  return typeof url === 'string' && url.startsWith(`${BASE}/gridpoints/`) ? url : null;
}

export function parsePrecip(json: unknown): PrecipSeries | null {
  const q = (json as { properties?: { quantitativePrecipitation?: PrecipSeries } } | null)?.properties
    ?.quantitativePrecipitation;
  return q && Array.isArray(q.values) ? q : null;
}

export const MARINE_ALERT = /small craft|gale|storm warning|hurricane|tropical storm|marine|high surf|rip current|hazardous seas|brisk wind|waterspout/i;
