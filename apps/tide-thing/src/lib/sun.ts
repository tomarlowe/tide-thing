// sunrise and sunset from the NOAA solar equations (general solar position calculations).
// good to a minute or two at US latitudes, which is plenty for a glanceable screen.
import type { LatLon } from './geo';

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;

function julianDay(ms: number): number {
  return ms / DAY_MS + 2440587.5;
}

function solarTerms(jd: number) {
  const t = (jd - 2451545) / 36525;
  const l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const c =
    Math.sin(m * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * m * RAD) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * m * RAD) * 0.000289;
  const trueLong = l0 + c;
  const omega = 125.04 - 1934.136 * t;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const seconds = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
  const obliq0 = 23 + (26 + seconds / 60) / 60;
  const obliq = obliq0 + 0.00256 * Math.cos(omega * RAD);
  const decl = Math.asin(Math.sin(obliq * RAD) * Math.sin(lambda * RAD)) / RAD;
  const y = Math.tan((obliq / 2) * RAD) ** 2;
  const eqTime =
    4 *
    (y * Math.sin(2 * l0 * RAD) -
      2 * e * Math.sin(m * RAD) +
      4 * e * y * Math.sin(m * RAD) * Math.cos(2 * l0 * RAD) -
      0.5 * y * y * Math.sin(4 * l0 * RAD) -
      1.25 * e * e * Math.sin(2 * m * RAD)) /
    RAD;
  return { decl, eqTime };
}

export type SunTimes = { sunrise: Date | null; sunset: Date | null; polar: 'day' | 'night' | null };

/** sunrise and sunset for the UTC day that contains `day`, positioned for `at`. */
export function sunTimes(day: Date, at: LatLon): SunTimes {
  const midnight = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
  const noonUtcMs = midnight + DAY_MS / 2 - (at.lon / 360) * DAY_MS;
  const { decl, eqTime } = solarTerms(julianDay(noonUtcMs));
  const cosH =
    (Math.cos(90.833 * RAD) - Math.sin(at.lat * RAD) * Math.sin(decl * RAD)) /
    (Math.cos(at.lat * RAD) * Math.cos(decl * RAD));
  if (cosH > 1) return { sunrise: null, sunset: null, polar: 'night' };
  if (cosH < -1) return { sunrise: null, sunset: null, polar: 'day' };
  const hourAngle = Math.acos(cosH) / RAD;
  const solarNoonMin = 720 - 4 * at.lon - eqTime;
  const riseMin = solarNoonMin - 4 * hourAngle;
  const setMin = solarNoonMin + 4 * hourAngle;
  return {
    sunrise: new Date(midnight + riseMin * 60_000),
    sunset: new Date(midnight + setMin * 60_000),
    polar: null,
  };
}
