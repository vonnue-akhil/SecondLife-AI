import type { StateCode } from '../../../shared/india-states';

export interface NearestPlace {
  place: string;
  district: string | null;
  state: StateCode;
}

interface PlacesTable {
  districts: string[];
  places: [string, StateCode, number, number, number][];
  outside: [number, number][];
}

/** Beyond this, the position is not in India (or not on land we have towns for). */
const MAX_KM = 150;

const km = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const x = (bLng - aLng) * Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  return Math.hypot(x, bLat - aLat) * 111.2;
};

/**
 * The nearest Indian town to a position, looked up entirely on the device from a bundled
 * GeoNames table (loaded on first use). Null when the position is outside India.
 */
export async function nearestPlace(lat: number, lng: number): Promise<NearestPlace | null> {
  const table = (await import('../data/india-places.json')).default as unknown as PlacesTable;

  let best: PlacesTable['places'][number] | null = null;
  let bestKm = Infinity;
  for (const p of table.places) {
    const d = km(lat, lng, p[3], p[4]);
    if (d < bestKm) [best, bestKm] = [p, d];
  }
  if (!best || bestKm > MAX_KM) return null;
  // A closer town across the border means the device is in a neighbouring country.
  if (table.outside.some(([oLat, oLng]) => km(lat, lng, oLat, oLng) < bestKm)) return null;

  const [place, state, districtIndex] = best;
  return { place, state, district: table.districts[districtIndex] ?? null };
}
