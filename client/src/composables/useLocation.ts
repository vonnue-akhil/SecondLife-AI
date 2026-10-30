import { computed, ref } from 'vue';
import type { UserLocation } from '../../../shared/schemas';
import { INDIAN_STATES, isStateCode, type StateCode } from '../../../shared/india-states';
import { nearestPlace } from '../lib/places';

const STORAGE_KEY = 'secondlife.location';

export class LocationError extends Error {}

/** Keeps only the characters the server accepts in a place name (see UserLocationSchema). */
function placeName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/[^\p{L}\p{M}\p{N} .,'()&-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 80).trim();
  return clean || null;
}

/** Reads a location saved on this device; anything unexpected counts as none. */
function load(): UserLocation | null {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    const l = raw as Partial<UserLocation> | null;
    if (!l || !isStateCode(l.state) || (l.source !== 'device' && l.source !== 'manual')) return null;
    return { state: l.state, district: placeName(l.district), place: placeName(l.place), source: l.source };
  } catch {
    return null;
  }
}

function save(value: UserLocation | null) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode or storage blocked: the location still applies for this visit.
  }
}

// Module-level: one location for the whole app, remembered on this device only.
const location = ref<UserLocation | null>(load());
const locating = ref(false);

/** Short label for chips, e.g. "Kochi, Kerala" or "Kerala". */
const label = computed(() => {
  const l = location.value;
  if (!l) return null;
  return l.place ? `${l.place}, ${INDIAN_STATES[l.state]}` : INDIAN_STATES[l.state];
});

function set(value: UserLocation | null) {
  location.value = value;
  save(value);
}

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false, // town-level is all we need; network positioning is faster
      timeout: 15_000,
      maximumAge: 30 * 60 * 1000,
    }),
  );
}

/** Asks the browser for the position and keeps only the nearest town, district and state. */
async function detect(): Promise<UserLocation> {
  if (!window.isSecureContext || !('geolocation' in navigator)) {
    throw new LocationError('This browser can’t share your location here. Choose your state below instead.');
  }
  locating.value = true;
  try {
    let position: GeolocationPosition;
    try {
      position = await currentPosition();
    } catch (err) {
      const denied = (err as GeolocationPositionError).code === 1; // PERMISSION_DENIED
      throw new LocationError(
        denied
          ? 'Location access is turned off for this site. Allow it in your browser settings, or choose your state below.'
          : 'We couldn’t find your position just now. Try again, or choose your state below.',
      );
    }
    const found = await nearestPlace(position.coords.latitude, position.coords.longitude);
    if (!found) throw new LocationError('SecondLife only covers India for now. If you are in India, choose your state below.');
    const value: UserLocation = { ...found, source: 'device' };
    set(value);
    return value;
  } finally {
    locating.value = false;
  }
}

function choose(state: StateCode, city: string) {
  set({ state, district: null, place: placeName(city), source: 'manual' });
}

export function useLocation() {
  return { location, locating, label, detect, choose, clear: () => set(null) };
}
