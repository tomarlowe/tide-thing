// NOAA CO-OPS request builders and parsers. no network here; the app fetches through the phone.
// times are requested in GMT so a station's local clock never has to be guessed.
import type { Datums, FloodLevelsRaw } from './flood';
import type { LatLon } from './geo';

const DATA = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
const MDAPI = 'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi';
// CO-OPS asks external callers to identify themselves with the application parameter
const APP = 'TideThing';

export type Station = { id: string; name: string; state: string; lat: number; lon: number };

export function stationsUrl(): string {
  return `${MDAPI}/stations.json?type=waterlevels&units=english`;
}

export function floodLevelsUrl(id: string): string {
  return `${MDAPI}/stations/${id}/floodlevels.json`;
}

export function datumsUrl(id: string): string {
  return `${MDAPI}/stations/${id}/datums.json?units=english`;
}

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

function dataUrl(id: string, product: string, extra: Record<string, string>): string {
  const q = new URLSearchParams({
    product,
    application: APP,
    station: id,
    time_zone: 'gmt',
    units: 'english',
    format: 'json',
    ...extra,
  });
  return `${DATA}?${q.toString()}`;
}

/** high and low tide predictions from `from` for `hours`. */
export function hiloUrl(id: string, from: Date, hours: number): string {
  return dataUrl(id, 'predictions', {
    begin_date: ymd(from),
    range: String(hours),
    datum: 'MLLW',
    interval: 'hilo',
  });
}

export function waterLevelUrl(id: string): string {
  return dataUrl(id, 'water_level', { date: 'latest', datum: 'MLLW' });
}

export function latestUrl(id: string, product: 'wind' | 'water_temperature' | 'air_pressure'): string {
  return dataUrl(id, product, { date: 'latest' });
}

export function parseStations(json: unknown): Station[] {
  const list = (json as { stations?: unknown[] } | null)?.stations;
  if (!Array.isArray(list)) return [];
  const out: Station[] = [];
  for (const s of list as Array<Record<string, unknown>>) {
    const lat = Number(s.lat);
    const lon = Number(s.lng);
    if (typeof s.id !== 'string' || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({ id: s.id, name: String(s.name ?? s.id), state: String(s.state ?? ''), lat, lon });
  }
  return out;
}

export type Extreme = { t: number; ft: number; kind: 'H' | 'L' };

function gmt(t: string): number {
  return Date.parse(`${t.replace(' ', 'T')}:00Z`);
}

export function parseHilo(json: unknown): Extreme[] {
  const list = (json as { predictions?: Array<{ t: string; v: string; type: string }> } | null)?.predictions;
  if (!Array.isArray(list)) return [];
  const out: Extreme[] = [];
  for (const p of list) {
    const t = gmt(p.t);
    const ft = Number(p.v);
    if (Number.isFinite(t) && Number.isFinite(ft) && (p.type === 'H' || p.type === 'L')) {
      out.push({ t, ft, kind: p.type });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

export type Reading = { t: number; value: number };

/** the newest reading in a data response; works for water_level, wind speed, water temp and pressure. */
export function parseLatest(json: unknown, field = 'v'): Reading | null {
  const data = (json as { data?: Array<Record<string, string>> } | null)?.data;
  if (!Array.isArray(data)) return null;
  for (let i = data.length - 1; i >= 0; i--) {
    const row = data[i]!;
    const value = Number(row[field]);
    if (row.t && row[field] !== '' && Number.isFinite(value)) return { t: gmt(row.t), value };
  }
  return null;
}

export type Wind = { t: number; knots: number; gustKnots: number | null; fromDeg: number | null; compass: string | null };

export function parseWind(json: unknown): Wind | null {
  const data = (json as { data?: Array<Record<string, string>> } | null)?.data;
  const row = Array.isArray(data) ? data[data.length - 1] : undefined;
  if (!row?.t) return null;
  const knots = Number(row.s);
  if (!Number.isFinite(knots)) return null;
  const gust = Number(row.g);
  const deg = Number(row.d);
  return {
    t: gmt(row.t),
    knots,
    gustKnots: row.g !== '' && Number.isFinite(gust) ? gust : null,
    fromDeg: row.d !== '' && Number.isFinite(deg) ? deg : null,
    compass: row.dr || null,
  };
}

export function parseFloodRaw(json: unknown): FloodLevelsRaw | null {
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  const num = (k: string) => (typeof o[k] === 'number' ? (o[k] as number) : null);
  return {
    nws_minor: num('nws_minor'),
    nws_moderate: num('nws_moderate'),
    nws_major: num('nws_major'),
    nos_minor: num('nos_minor'),
    nos_moderate: num('nos_moderate'),
    nos_major: num('nos_major'),
  };
}

export function parseDatums(json: unknown): Datums | null {
  const list = (json as { datums?: Array<{ name: string; value: number | string }> } | null)?.datums;
  if (!Array.isArray(list)) return null;
  const get = (name: string) => {
    const hit = list.find(d => d.name === name);
    const v = hit == null ? NaN : Number(hit.value);
    return Number.isFinite(v) ? v : null;
  };
  const mllw = get('MLLW');
  const mhhw = get('MHHW');
  return mllw == null || mhhw == null ? null : { mllw, mhhw };
}

export function toLatLon(s: Station): LatLon & { id: string } {
  return { id: s.id, lat: s.lat, lon: s.lon };
}
