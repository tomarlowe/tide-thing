// fetches everything through the phone and keeps one Snapshot up to date. every part fails on its own:
// a failed refresh leaves the previous numbers in place, and the screens label their age.
import type { BridgethingClient } from '@bridgething/client';
import { parseAlerts, spokenText } from './alerts';
import { floodLevelsMllw } from './flood';
import { nearest, roundForNetwork, type LatLon } from './geo';
import {
  ACTIVE_STATIONS_URL,
  latestObsUrl,
  parseActiveStations,
  parseLatestObs,
  type Buoy,
} from './ndbc';
import {
  datumsUrl,
  floodLevelsUrl,
  hiloUrl,
  latestUrl,
  parseDatums,
  parseFloodRaw,
  parseHilo,
  parseLatest,
  parseStations,
  parseWind,
  stationsUrl,
  toLatLon,
  waterLevelUrl,
  type Station,
} from './noaa';
import { alertsUrl, NWS_HEADERS, parseGridUrl, parsePrecip, pointsUrl } from './nws';
import { rainInches, rainLevel } from './rain';
import { EMPTY, type Snapshot } from './snapshot';

type Header = { name: string; value: string };
export type Fetcher = (url: string, headers?: Header[]) => Promise<{ status: number; text: string }>;

export function phoneFetcher(client: BridgethingClient): Fetcher {
  return async (url, headers = []) => {
    const r = await client.net.fetch(
      { request: { url, method: 'GET', headers, timeoutMs: 20_000, redirect: 'follow' } },
      { timeoutMs: 25_000 },
    );
    if (!r.ok) throw new Error('the phone could not fetch');
    const res = r.response.response;
    return { status: res.status, text: new TextDecoder().decode(Uint8Array.from(res.body as ArrayLike<number>)) };
  };
}

export type KV = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
};

export function phoneStore(client: BridgethingClient): KV {
  return {
    async get(key) {
      const r = await client.store.get({ key });
      return r.ok ? r.response.value : null;
    },
    async put(key, value) {
      await client.store.put({ key, value });
    },
  };
}

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const MAX_STATION_MILES = 150;
const MAX_BUOY_MILES = 120;

export type Speaker = (id: string, text: string) => void;

export type Deps = {
  fetcher: Fetcher;
  kv: KV;
  locate: () => Promise<LatLon | null>;
  speak: Speaker;
  now: () => number;
  timeText: (ms: number) => string;
};

export class TideData {
  private snap: Snapshot = { ...EMPTY };
  private listeners = new Set<(s: Snapshot) => void>();
  private timers: ReturnType<typeof setInterval>[] = [];
  private spoken = new Map<string, number>();
  private lastBuoy = 0;
  private lastRain = 0;

  constructor(private d: Deps) {}

  get value(): Snapshot {
    return this.snap;
  }

  subscribe(fn: (s: Snapshot) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<Snapshot>) {
    this.snap = { ...this.snap, ...patch };
    for (const fn of this.listeners) fn(this.snap);
  }

  setConnected(connected: boolean) {
    if (connected !== this.snap.connected) this.set({ connected });
  }

  setSpeak(speak: boolean) {
    this.set({ speak });
    void this.d.kv.put('speak.v1', speak ? '1' : '0').catch(() => {});
  }

  async start() {
    const [spoken, speak] = await Promise.all([
      this.readJson<Record<string, number>>('spoken.v1'),
      this.d.kv.get('speak.v1').catch(() => null),
    ]);
    for (const [id, at] of Object.entries(spoken ?? {})) this.spoken.set(id, at);
    if (speak === '0') this.set({ speak: false });
    await this.refreshAll();
    this.timers.push(setInterval(() => void this.refreshAll(), 5 * MIN));
  }

  stop() {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }

  private async readJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.d.kv.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private async cached<T>(key: string, maxAgeMs: number, load: () => Promise<T | null>): Promise<T | null> {
    const hit = await this.readJson<{ at: number; data: T }>(key);
    if (hit && this.d.now() - hit.at < maxAgeMs) return hit.data;
    try {
      const data = await load();
      if (data != null) await this.d.kv.put(key, JSON.stringify({ at: this.d.now(), data })).catch(() => {});
      return data ?? hit?.data ?? null;
    } catch {
      return hit?.data ?? null;
    }
  }

  private async getJson(url: string, headers?: Header[]): Promise<unknown> {
    const r = await this.d.fetcher(url, headers);
    if (r.status < 200 || r.status >= 300) throw new Error(`status ${r.status}`);
    return JSON.parse(r.text);
  }

  private busy = false;

  async refreshAll() {
    if (this.busy) return;
    this.busy = true;
    try {
      const now = this.d.now();
      const where = await this.locate();
      if (!where) return;
      await this.pickStation(where);
      const st = this.snap.station;
      await Promise.allSettled([
        st ? this.refreshTides(st.id, now) : Promise.resolve(),
        this.refreshAlerts(where),
        now - this.lastRain > 25 * MIN ? this.refreshRain(where) : Promise.resolve(),
        now - this.lastBuoy > 25 * MIN ? this.refreshBuoy(where) : Promise.resolve(),
      ]);
    } finally {
      this.busy = false;
    }
  }

  private async locate(): Promise<LatLon | null> {
    let fix: LatLon | null = null;
    try {
      fix = await this.d.locate();
    } catch {
      fix = null;
    }
    if (fix) {
      const where = roundForNetwork(fix);
      this.set({ where });
      void this.d.kv.put('where.v1', JSON.stringify(where)).catch(() => {});
      return where;
    }
    const last = await this.readJson<LatLon>('where.v1');
    if (last) {
      this.set({ where: last });
      return last;
    }
    this.set({ problem: 'Waiting for your phone to share a location.' });
    return null;
  }

  private async pickStation(where: LatLon) {
    const list = await this.cached<Station[]>('stations.v1', 30 * DAY, async () =>
      parseStations(await this.getJson(stationsUrl())),
    );
    if (!list || list.length === 0) {
      this.set({ problem: 'Could not load the NOAA station list yet.' });
      return;
    }
    const hit = nearest(where, list.map(toLatLon));
    const station = hit ? list.find(s => s.id === hit.item.id) : null;
    if (!hit || !station || hit.miles > MAX_STATION_MILES) {
      this.set({
        station: null,
        problem: 'No NOAA tide station within 150 miles. Tide Thing covers US coasts only.',
      });
      return;
    }
    if (this.snap.station?.id !== station.id) {
      this.set({ extremes: [], observed: null, datums: null, flood: null, wind: null, waterTempF: null });
    }
    this.set({ station: { ...station, miles: hit.miles }, problem: null });
  }

  private async refreshTides(id: string, now: number) {
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - 1);
    const [hilo, level, wind, temp, pres, statics] = await Promise.allSettled([
      this.getJson(hiloUrl(id, from, 33 * 24)),
      this.getJson(waterLevelUrl(id)),
      this.getJson(latestUrl(id, 'wind')),
      this.getJson(latestUrl(id, 'water_temperature')),
      this.getJson(latestUrl(id, 'air_pressure')),
      this.loadStatics(id),
    ]);
    const patch: Partial<Snapshot> = {};
    if (hilo.status === 'fulfilled') {
      const extremes = parseHilo(hilo.value);
      if (extremes.length) {
        patch.extremes = extremes;
        patch.extremesAt = now;
      }
    }
    if (level.status === 'fulfilled') patch.observed = parseLatest(level.value);
    let metOk = false;
    if (wind.status === 'fulfilled') {
      patch.wind = parseWind(wind.value);
      metOk = true;
    }
    if (temp.status === 'fulfilled') {
      patch.waterTempF = parseLatest(temp.value)?.value ?? null;
      metOk = true;
    }
    if (pres.status === 'fulfilled') {
      patch.pressureMb = parseLatest(pres.value)?.value ?? null;
      metOk = true;
    }
    if (metOk) patch.metAt = now;
    if (statics.status === 'fulfilled' && statics.value) {
      patch.datums = statics.value.datums;
      patch.flood = statics.value.flood;
    }
    this.set(patch);
  }

  private async loadStatics(id: string) {
    return this.cached(`static.${id}`, 30 * DAY, async () => {
      const [dj, fj] = await Promise.allSettled([this.getJson(datumsUrl(id)), this.getJson(floodLevelsUrl(id))]);
      const datums = dj.status === 'fulfilled' ? parseDatums(dj.value) : null;
      const raw = fj.status === 'fulfilled' ? parseFloodRaw(fj.value) : null;
      if (!datums) return null;
      return { datums, flood: floodLevelsMllw(raw, datums) };
    });
  }

  private async refreshAlerts(where: LatLon) {
    const spots: LatLon[] = [where];
    const st = this.snap.station;
    if (st) spots.push(roundForNetwork({ lat: st.lat, lon: st.lon }));
    const results = await Promise.allSettled(spots.map(p => this.d.fetcher(alertsUrl(p), NWS_HEADERS)));
    const now = this.d.now();
    const lists = [];
    let problem: string | null = null;
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      if (r.value.status === 401 || r.value.status === 403) {
        problem = 'NWS access has changed. Alerts may be missing.';
        continue;
      }
      if (r.value.status < 200 || r.value.status >= 300) continue;
      try {
        lists.push(parseAlerts(JSON.parse(r.value.text), new Date(now)));
      } catch {
        // an unreadable answer counts as no answer
      }
    }
    if (lists.length === 0) {
      this.set({ alertsProblem: problem ?? 'Could not reach the Weather Service.' });
      return;
    }
    const merged = new Map<string, (typeof lists)[number][number]>();
    for (const a of lists.flat()) merged.set(a.id, a);
    const alerts = [...merged.values()].sort(
      (a, b) => Number(b.level === 'warning') - Number(a.level === 'warning') || (a.ends ?? Infinity) - (b.ends ?? Infinity),
    );
    this.set({ alerts, alertsAt: now, alertsProblem: problem });
    this.maybeSpeak(alerts, now);
  }

  private maybeSpeak(alerts: Snapshot['alerts'], now: number) {
    if (!this.snap.speak) return;
    for (const [id, at] of this.spoken) if (now - at > 12 * 60 * MIN) this.spoken.delete(id);
    let said = false;
    for (const a of alerts) {
      if (a.level !== 'warning' || this.spoken.has(a.id)) continue;
      this.spoken.set(a.id, now);
      said = true;
      this.d.speak(a.id, spokenText(a, a.ends ? this.d.timeText(a.ends) : null));
      break; // one at a time; the next one is read on the next pass
    }
    if (said) void this.d.kv.put('spoken.v1', JSON.stringify(Object.fromEntries(this.spoken))).catch(() => {});
  }

  private async refreshRain(where: LatLon) {
    this.lastRain = this.d.now();
    try {
      const grid = await this.cached<string>(`grid.${where.lat},${where.lon}`, 7 * DAY, async () => {
        const r = await this.d.fetcher(pointsUrl(where), NWS_HEADERS);
        return r.status === 200 ? parseGridUrl(JSON.parse(r.text)) : null;
      });
      if (!grid) return;
      const r = await this.d.fetcher(grid, NWS_HEADERS);
      if (r.status !== 200) return;
      const series = parsePrecip(JSON.parse(r.text));
      const inches = rainInches(series, new Date(this.d.now()), 6);
      if (inches != null) this.set({ rain: { inches, level: rainLevel(inches) }, rainAt: this.d.now() });
    } catch {
      // keep the earlier outlook; its age is shown
    }
  }

  private async refreshBuoy(where: LatLon) {
    this.lastBuoy = this.d.now();
    try {
      const list = await this.cached<Buoy[]>('buoys.v1', 30 * DAY, async () => {
        const r = await this.d.fetcher(ACTIVE_STATIONS_URL);
        return r.status === 200 ? parseActiveStations(r.text) : null;
      });
      if (!list?.length) return;
      const hit = nearest(where, list);
      if (!hit || hit.miles > MAX_BUOY_MILES) {
        this.set({ buoy: null });
        return;
      }
      const r = await this.d.fetcher(latestObsUrl(hit.item.id));
      if (r.status !== 200) return;
      this.set({ buoy: { buoy: { ...hit.item, miles: hit.miles }, obs: parseLatestObs(r.text) }, buoyAt: this.d.now() });
    } catch {
      // keep the earlier reading
    }
  }
}
