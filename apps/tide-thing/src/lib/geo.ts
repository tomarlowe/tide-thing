// the only place a location is shaped for the network. 0.01 degrees is about 1 km, which is the
// most precision that ever leaves the phone.
export type LatLon = { lat: number; lon: number };

export function roundForNetwork(p: LatLon): LatLon {
  return { lat: Math.round(p.lat * 100) / 100, lon: Math.round(p.lon * 100) / 100 };
}

const EARTH_MILES = 3958.8;

export function distanceMiles(a: LatLon, b: LatLon): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type Located = LatLon & { id: string };

export function nearest<T extends Located>(from: LatLon, items: T[]): { item: T; miles: number } | null {
  let best: { item: T; miles: number } | null = null;
  for (const item of items) {
    const miles = distanceMiles(from, item);
    if (!best || miles < best.miles) best = { item, miles };
  }
  return best;
}
