/**
 * Trip planning against Google, through whichever routing API the map key is
 * allowed to use.
 *
 * The Routes API (google.maps.routes.Route) is tried first: it is Google's
 * current one, and DirectionsService has been deprecated since February 2026.
 * If the key's API restrictions block it, the legacy Directions API is tried,
 * because an older key may carry that one and not the other. Either way the
 * caller gets the same shape back:
 *
 *   [{ seconds, durationText, distanceText, summary, path: [{lat, lng}] }]
 */

/** Thrown when neither routing API is allowed for this key. */
export class RoutingBlockedError extends Error {}

const blocked = (message) => /PERMISSION_DENIED|REQUEST_DENIED|blocked|not authorized/i.test(message ?? '');

const toLiteral = (p) => (typeof p.lat === 'function' ? { lat: p.lat(), lng: p.lng() } : { lat: p.lat, lng: p.lng });

async function viaRoutes({ origin, destination, mode, departure }) {
  const { Route } = await window.google.maps.importLibrary('routes');
  const request = {
    origin,
    destination,
    travelMode: mode,
    computeAlternativeRoutes: mode === 'DRIVING',
    fields: ['durationMillis', 'distanceMeters', 'localizedValues', 'description', 'path'],
  };
  // Traffic and timetables only apply with a departure time, which must not
  // be in the past.
  const when = departure > new Date() ? departure : new Date(Date.now() + 60_000);
  if (mode === 'DRIVING') {
    request.routingPreference = 'TRAFFIC_AWARE';
    request.departureTime = when;
  }
  if (mode === 'TRANSIT') request.departureTime = when;

  const { routes = [] } = await Route.computeRoutes(request);
  return routes.map((r) => ({
    seconds: Math.round((r.durationMillis ?? 0) / 1000),
    durationText: r.localizedValues?.duration ?? null,
    distanceText: r.localizedValues?.distance ?? null,
    summary: r.description ?? '',
    path: (r.path ?? []).map(toLiteral),
  }));
}

function viaDirections({ origin, destination, mode, departure }) {
  return new Promise((resolve, reject) => {
    new window.google.maps.DirectionsService().route(
      {
        origin,
        destination,
        travelMode: mode,
        provideRouteAlternatives: true,
        ...(mode === 'DRIVING' && { drivingOptions: { departureTime: departure, trafficModel: 'bestguess' } }),
        ...(mode === 'TRANSIT' && { transitOptions: { departureTime: departure } }),
      },
      (result, status) => {
        if (status !== 'OK') {
          reject(Object.assign(new Error(status), { status }));
          return;
        }
        resolve(
          result.routes.map((r) => {
            const leg = r.legs[0];
            const duration = leg.duration_in_traffic ?? leg.duration;
            return {
              seconds: duration.value,
              durationText: duration.text,
              distanceText: leg.distance.text,
              summary: r.summary ?? '',
              path: r.overview_path.map(toLiteral),
            };
          }),
        );
      },
    );
  });
}

export async function computeTrip(trip) {
  let routesError;
  try {
    const routes = await viaRoutes(trip);
    if (routes.length) return routes;
  } catch (err) {
    routesError = err;
  }
  try {
    return await viaDirections(trip);
  } catch (err) {
    if (err.status === 'ZERO_RESULTS') return [];
    if (blocked(routesError?.message) && blocked(err.message ?? err.status)) {
      throw new RoutingBlockedError('Both routing APIs are blocked for this key.');
    }
    throw err;
  }
}

const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

/** "1 hr 5 min" when Google did not supply its own wording. */
export function formatSeconds(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h} hr ${m} min` : `${m} min`;
}

export function formatArrival(departure, seconds) {
  return clock.format(new Date(departure.getTime() + seconds * 1000));
}
