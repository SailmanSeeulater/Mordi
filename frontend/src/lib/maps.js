import { Loader } from '@googlemaps/js-api-loader';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

/** Whether this build was given a Maps key at all. Without one the Places
 *  page shows its list and says so, instead of an empty map frame. */
export const MAPS_CONFIGURED = Boolean(MAPS_KEY);

/**
 * The one way the Maps JavaScript API gets onto the page. The Places page
 * needs it for the map, and reverse geocoding (the weather strip, the log
 * form) needs its Geocoder, so both come through here: the SDK's Loader is a
 * singleton that throws if it is built a second time with different options,
 * and going through the SDK keeps the key out of our own request URLs. The
 * SDK still sends it with the script tag, so the key is restricted to this
 * site's referrers in Google Cloud Console.
 */
let loader = null;

/**
 * Resolves to the named Maps library ('maps', 'geocoding', ...) once the SDK
 * has loaded. Rejects when there is no key or Google could not be reached.
 */
export function loadMapsLibrary(name) {
  if (!MAPS_KEY) return Promise.reject(new Error('no Maps key'));
  // The same script parameters the Places page always loaded with, so the
  // map keeps its English, US-region labels whichever page asks first.
  loader ??= new Loader({ apiKey: MAPS_KEY, version: 'weekly', language: 'en', region: 'US' });
  return loader.importLibrary(name);
}
