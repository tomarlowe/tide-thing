import type { Alert } from './alerts';
import type { Datums, FloodLevels } from './flood';
import type { LatLon } from './geo';
import type { Buoy, BuoyObs } from './ndbc';
import type { Extreme, Reading, Station, Wind } from './noaa';
import type { RainLevel } from './rain';

export type NearStation = Station & { miles: number };
export type NearBuoy = Buoy & { miles: number };

export type Snapshot = {
  connected: boolean;
  where: LatLon | null;
  station: NearStation | null;
  /** why there is no station, in words for the screen */
  problem: string | null;
  extremes: Extreme[];
  extremesAt: number | null;
  observed: Reading | null;
  datums: Datums | null;
  flood: FloodLevels | null;
  wind: Wind | null;
  waterTempF: number | null;
  pressureMb: number | null;
  metAt: number | null;
  alerts: Alert[];
  alertsAt: number | null;
  alertsProblem: string | null;
  rain: { inches: number; level: RainLevel } | null;
  rainAt: number | null;
  buoy: { buoy: NearBuoy; obs: BuoyObs } | null;
  buoyAt: number | null;
  speak: boolean;
};

export const EMPTY: Snapshot = {
  connected: false,
  where: null,
  station: null,
  problem: null,
  extremes: [],
  extremesAt: null,
  observed: null,
  datums: null,
  flood: null,
  wind: null,
  waterTempF: null,
  pressureMb: null,
  metAt: null,
  alerts: [],
  alertsAt: null,
  alertsProblem: null,
  rain: null,
  rainAt: null,
  buoy: null,
  buoyAt: null,
  speak: true,
};
