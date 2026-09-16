const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

/** The last place the browser reported, so the weather strip and the log form
 *  don't each have to ask for permission again. Per-device, never sent anywhere
 *  except where the caller sends it. */
const CACHE_KEY = 'mordi-last-place';

export function readCachedPlace() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const place = JSON.parse(raw);
    return typeof place?.latitude === 'number' && typeof place?.longitude === 'number'
      ? place
      : null;
  } catch {
    return null;
  }
}

export function writeCachedPlace(place) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(place));
  } catch {
    // Private windows and blocked site data both throw here. Losing the cache
    // only costs one extra permission prompt.
  }
}

export function getPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
      ...options,
    });
  });
}

/** Rounds to ~11m. Enough to name a place, short of a precise fix. */
export const round = (n) => Math.round(n * 10000) / 10000;

export function reverseGeocode(latitude, longitude) {
  if (!MAPS_KEY) return Promise.resolve('');
  return fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${MAPS_KEY}`,
  )
    .then((res) => res.json())
    .then((data) => data.results?.[0]?.formatted_address ?? '')
    .catch(() => '');
}

/** A short label for a formatted address: the street line plus the town. */
export function shortPlace(address) {
  if (!address) return '';
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.slice(0, 2).join(', ');
}

/**
 * Asks the browser where we are and names it. Resolves to
 * `{ latitude, longitude, placeName }`; rejects if permission is refused.
 */
export async function capturePlace() {
  const position = await getPosition();
  const latitude = round(position.coords.latitude);
  const longitude = round(position.coords.longitude);
  const placeName = shortPlace(await reverseGeocode(latitude, longitude));
  const place = { latitude, longitude, placeName };
  writeCachedPlace(place);
  return place;
}
