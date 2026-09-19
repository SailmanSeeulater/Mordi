import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF, PolylineF } from "@react-google-maps/api";
import { useTheme } from "../context/useTheme";
import useDocumentTitle from "../hooks/useDocumentTitle";
import client from "../api/client";
import AppShell from "../components/AppShell";
import TripPlanner from "../components/TripPlanner";
import "./locations.css";

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const DEFAULT_CENTER = { lat: 32.7157, lng: -117.1611 };
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

// Google Maps styles only accept hex, so the active theme's tokens are read off
// the DOM and converted. The map then changes colour with the rest of the app.
function readToken(name, fallback) {
  if (typeof window === "undefined") return fallback;
  const root = document.querySelector("[data-theme]") ?? document.documentElement;
  const raw = getComputedStyle(root).getPropertyValue(name).trim();
  if (!raw) return fallback;
  if (raw.startsWith("#")) return raw;
  const nums = raw.match(/[\d.]+/g);
  if (!nums || nums.length < 3) return fallback;
  return (
    "#" +
    nums
      .slice(0, 3)
      .map((n) => Math.round(parseFloat(n)).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Mixes two hex colors, so roads and water sit either side of the ground. */
function mix(a, b, weight) {
  const parse = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  return (
    "#" +
    [ar, ag, ab]
      .map((c, i) => Math.round(c * weight + [br, bg, bb][i] * (1 - weight)))
      .map((c) => c.toString(16).padStart(2, "0"))
      .join("")
  );
}

function buildMapOptions() {
  const bg = readToken("--color-bg", "#ece7dd");
  const surface = readToken("--color-surface", "#e4ddd0");
  const text = readToken("--color-text", "#1a1714");
  const muted = mix(text, bg, 0.7);

  return {
    disableDefaultUI: true,
    zoomControl: true,
    clickableIcons: false,
    styles: [
      { elementType: "geometry", stylers: [{ color: bg }] },
      { elementType: "labels.text.fill", stylers: [{ color: muted }] },
      { elementType: "labels.text.stroke", stylers: [{ color: bg }] },
      { featureType: "poi", stylers: [{ visibility: "off" }] },
      { featureType: "transit", stylers: [{ visibility: "off" }] },
      { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: surface }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: mix(bg, text, 0.94) }] },
      { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: mix(bg, text, 0.82) }] },
      { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: mix(surface, text, 0.86) }] },
      { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: mix(bg, text, 0.72) }] },
    ],
  };
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

function buildMarkerIcon() {
  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    scale: 7,
    fillColor: readToken("--color-accent", "#d2452a"),
    fillOpacity: 1,
    strokeColor: readToken("--color-text", "#1a1714"),
    strokeWeight: 2,
  };
}

function formatDay(recordedAt) {
  return recordedAt ? dateFormat.format(new Date(recordedAt)) : "";
}

function reverseGeocode(lat, lng) {
  return fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${MAPS_KEY}`,
  )
    .then((res) => res.json())
    .then((data) => data.results?.[0]?.formatted_address || "Unknown location")
    .catch(() => "Unknown location");
}

function getPosition() {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
    }),
  );
}

export default function Locations() {
  useDocumentTitle("Places");

  const [locations, setLocations] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [status, setStatus] = useState({ tone: "info", text: "" });
  // A pin dropped by tapping the map or found by search: { position, label }.
  const [pin, setPin] = useState(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  // The two ends of a trip, and which one the next map tap sets, if any.
  const [trip, setTrip] = useState({ a: { kind: "me", label: "Your location" }, b: null });
  const [picking, setPicking] = useState(null);
  // The drawn trip: { routes, departure, origin, destination, mode, index }.
  const [route, setRoute] = useState(null);
  const mapRef = useRef(null);
  const framedFirst = useRef(false);

  const { theme } = useTheme();
  const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: MAPS_KEY });

  // Rebuilt when the combination changes, so the map re-styles with the app.
  // Both of these read the palette off the DOM, so they have to be recomputed
  // when the combination changes; `theme` is that trigger.
  const mapOptions = useMemo(() => {
    void theme;
    return isLoaded ? { ...buildMapOptions(), draggableCursor: picking ? "crosshair" : undefined } : null;
  }, [isLoaded, theme, picking]);

  useEffect(() => {
    let cancelled = false;
    client
      .get("/api/locations")
      .then((res) => {
        if (cancelled) return;
        if (!Array.isArray(res.data)) {
          setLoadState("error");
          return;
        }
        setLocations(res.data);
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const places = useMemo(
    () => [...locations].sort((a, b) => (b.recordedAt ?? "").localeCompare(a.recordedAt ?? "")),
    [locations],
  );
  const selected = places.find((p) => p.id === selectedId) ?? null;

  /*
   * The map is given a centre once and then moved with panTo, never by
   * changing its `center` prop: a new centre is a jump cut, panTo is a glide.
   * Google only animates a pan that stays within about a screen; anything
   * further is still a cut, which is what Google Maps itself does.
   */
  const [initialCenter] = useState(DEFAULT_CENTER);
  const glideTo = useCallback((position, zoom) => {
    const map = mapRef.current;
    if (!map || !position) return;
    map.panTo(position);
    if (zoom && (map.getZoom() ?? 0) < zoom) {
      window.google.maps.event.addListenerOnce(map, "idle", () => map.setZoom(zoom));
    }
  }, []);

  // Once the saved places arrive, glide to the latest one.
  useEffect(() => {
    if (framedFirst.current || !isLoaded || !mapRef.current || !places[0]) return;
    framedFirst.current = true;
    glideTo({ lat: places[0].latitude, lng: places[0].longitude });
  }, [isLoaded, places, glideTo]);

  // Frame the whole trip once it is planned, as a maps app does.
  useEffect(() => {
    const map = mapRef.current;
    const path = route?.routes[route.index]?.path;
    if (!map || !path?.length) return;
    const bounds = new window.google.maps.LatLngBounds();
    path.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 56);
  }, [route]);

  const lookUp = (lat, lng, then) => {
    new window.google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, geoStatus) => {
      then(geoStatus === "OK" && results?.[0] ? results[0].formatted_address : `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    });
  };

  /* Dropping a pin: tap the map, and the address is looked up for it. */
  const dropPin = (lat, lng, knownLabel) => {
    setSelectedId(null);
    setPin({ position: { lat, lng }, label: knownLabel ?? "Finding the address…" });
    glideTo({ lat, lng }, knownLabel ? 15 : undefined);
    if (knownLabel) return;
    lookUp(lat, lng, (label) =>
      setPin((current) =>
        current && current.position.lat === lat && current.position.lng === lng ? { ...current, label } : current,
      ),
    );
  };

  const setPoint = useCallback((which, point) => {
    setTrip((t) => ({ ...t, [which]: point }));
  }, []);

  /* A tap on the map sets A or B while picking, and drops a pin otherwise. */
  const onMapClick = (e) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    if (picking) {
      const which = picking;
      setPicking(null);
      setPoint(which, { kind: "map", label: "Finding the address…", position: { lat, lng } });
      glideTo({ lat, lng });
      lookUp(lat, lng, (label) =>
        setTrip((t) =>
          t[which]?.position?.lat === lat && t[which]?.position?.lng === lng
            ? { ...t, [which]: { ...t[which], label } }
            : t,
        ),
      );
      return;
    }
    dropPin(lat, lng);
  };

  const directions = (which, point) => {
    setPoint(which, point);
    setPicking(null);
  };

  const swap = () => setTrip((t) => ({ a: t.b, b: t.a }));

  const search = (e) => {
    e.preventDefault();
    if (!query.trim() || !isLoaded) return;
    setSearching(true);
    new window.google.maps.Geocoder().geocode({ address: query.trim() }, (results, geoStatus) => {
      setSearching(false);
      if (geoStatus !== "OK" || !results?.[0]) {
        setStatus({
          tone: "error",
          text:
            geoStatus === "REQUEST_DENIED"
              ? "Search is turned off for this map key. Enable the Geocoding API for it in Google Cloud Console."
              : `Couldn't find "${query.trim()}". Try a fuller address.`,
        });
        return;
      }
      const loc = results[0].geometry.location;
      setStatus({ tone: "info", text: "" });
      dropPin(loc.lat(), loc.lng(), results[0].formatted_address);
    });
  };

  const savePin = async () => {
    if (!pin) return;
    setSavingPin(true);
    try {
      const res = await client.post("/api/locations", {
        latitude: pin.position.lat,
        longitude: pin.position.lng,
        placeName: pin.label,
      });
      setStatus({ tone: "info", text: `Saved ${pin.label}.` });
      setPin(null);
      setSelectedId(res.data?.id ?? null);
      reload();
    } catch {
      setStatus({ tone: "error", text: "Couldn't save this place. Check your connection and try again." });
    } finally {
      setSavingPin(false);
    }
  };

  const markerIcon = useMemo(() => {
    void theme;
    return isLoaded ? buildMarkerIcon() : undefined;
  }, [isLoaded, theme]);

  const captureLocation = async () => {
    if (!navigator.geolocation) {
      setStatus({ tone: "error", text: "This browser can't share your location." });
      return;
    }
    setCapturing(true);
    setStatus({ tone: "info", text: "Finding your location…" });

    let position;
    try {
      position = await getPosition();
    } catch (err) {
      setCapturing(false);
      setStatus({
        tone: "error",
        text:
          err?.code === 1
            ? "Location access is blocked. Allow it in your browser's site settings, then try again."
            : "Couldn't get your location. Check that location services are on, then try again.",
      });
      return;
    }

    const { latitude, longitude } = position.coords;
    try {
      const placeName = await reverseGeocode(latitude, longitude);
      const res = await client.post("/api/locations", { latitude, longitude, placeName });
      setStatus({ tone: "info", text: `Saved ${placeName}.` });
      setSelectedId(res.data?.id ?? null);
      glideTo({ lat: latitude, lng: longitude });
      reload();
    } catch {
      setStatus({ tone: "error", text: "Couldn't save this place. Check your connection and try again." });
    } finally {
      setCapturing(false);
    }
  };

  const selectPlace = (loc) => {
    setSelectedId(loc.id);
    glideTo({ lat: loc.latitude, lng: loc.longitude });
  };

  const accent = readToken("--color-accent", "#d2452a");
  const ink = readToken("--color-text", "#1a1714");

  // A and B markers: shown as soon as each end is known, before any route.
  const endMarker = (letter, position) =>
    position && (
      <MarkerF
        key={letter}
        position={position}
        label={{ text: letter, color: "#ffffff", fontWeight: "600" }}
        title={letter === "A" ? "Start" : "Destination"}
        zIndex={5}
      />
    );

  return (
    <AppShell title="Places">
      <div className="loc">
        <section className="app-panel loc__map-panel" aria-labelledby="loc-title">
          <div className="app-panel__head">
            <h2 id="loc-title" className="app-panel__title">
              Map
            </h2>
            {loadState === "ready" && (
              <span className="app-panel__meta">{places.length} saved</span>
            )}
            <div className="app-panel__spacer" />
            <button type="button" className="app-btn" onClick={captureLocation} disabled={capturing}>
              {capturing ? "Finding you…" : "Save my location"}
            </button>
          </div>

          <form className="loc__search" onSubmit={search} role="search">
            <label className="app-sr" htmlFor="loc-search">
              Search for a place
            </label>
            <input
              id="loc-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search an address, or tap the map to drop a pin"
              autoComplete="off"
            />
            <button type="submit" className="app-btn app-btn--quiet" disabled={searching || !isLoaded}>
              {searching ? "Finding…" : "Search"}
            </button>
          </form>

          <div role="status">
            {status.text && (
              <p className={"loc__status" + (status.tone === "error" ? " loc__status--error" : "")}>
                {status.text}
              </p>
            )}
          </div>

          <div className={`loc__map${picking ? " loc__map--picking" : ""}`}>
            {loadError ? (
              <p className="app-empty">The map couldn&rsquo;t load. Your saved places are still listed.</p>
            ) : !isLoaded ? (
              <p className="app-empty">Loading map…</p>
            ) : (
              <GoogleMap
                mapContainerStyle={MAP_CONTAINER_STYLE}
                center={initialCenter}
                zoom={12}
                options={mapOptions}
                onClick={onMapClick}
                onLoad={(map) => {
                  mapRef.current = map;
                }}
                onUnmount={() => {
                  mapRef.current = null;
                }}
              >
                {places.map((loc) => (
                  <MarkerF
                    key={loc.id}
                    position={{ lat: loc.latitude, lng: loc.longitude }}
                    icon={markerIcon}
                    title={loc.placeName || "Saved place"}
                    onClick={() => selectPlace(loc)}
                  />
                ))}
                {pin && <MarkerF position={pin.position} title={pin.label} />}
                {/* Alternatives faint underneath, the chosen route on top. */}
                {route?.routes.map((r, i) =>
                  i === route.index ? null : (
                    <PolylineF
                      key={`alt-${i}`}
                      path={r.path}
                      options={{ strokeColor: ink, strokeOpacity: 0.28, strokeWeight: 5, clickable: true }}
                      onClick={() => setRoute((cur) => (cur ? { ...cur, index: i } : cur))}
                    />
                  ),
                )}
                {route && (
                  <PolylineF
                    path={route.routes[route.index].path}
                    options={{ strokeColor: accent, strokeWeight: 6, zIndex: 2 }}
                  />
                )}
                {endMarker("A", route?.origin ?? trip.a?.position)}
                {endMarker("B", route?.destination ?? trip.b?.position)}
                {selected && (
                  <InfoWindowF
                    position={{ lat: selected.latitude, lng: selected.longitude }}
                    onCloseClick={() => setSelectedId(null)}
                  >
                    <div className="loc__info">
                      <strong>{selected.placeName || "Unknown location"}</strong>
                      <span>{formatDay(selected.recordedAt)}</span>
                      <button
                        type="button"
                        className="loc__info-go"
                        onClick={() =>
                          directions("b", {
                            kind: "place",
                            id: selected.id,
                            label: selected.placeName || "Saved place",
                            position: { lat: selected.latitude, lng: selected.longitude },
                          })
                        }
                      >
                        Directions here
                      </button>
                    </div>
                  </InfoWindowF>
                )}
              </GoogleMap>
            )}
          </div>

          {pin && (
            <div className="loc__pin">
              <div className="loc__pin-text">
                <strong>Dropped pin</strong>
                <span>{pin.label}</span>
              </div>
              <div className="loc__pin-actions">
                <button
                  type="button"
                  className="app-btn app-btn--sm"
                  onClick={() => directions("b", { kind: "pin", label: pin.label, position: pin.position })}
                >
                  Directions
                </button>
                <button
                  type="button"
                  className="app-btn app-btn--quiet app-btn--sm"
                  onClick={() => directions("a", { kind: "pin", label: pin.label, position: pin.position })}
                >
                  Start here
                </button>
                <button type="button" className="app-btn app-btn--quiet app-btn--sm" onClick={savePin} disabled={savingPin}>
                  {savingPin ? "Saving…" : "Save"}
                </button>
                <button type="button" className="app-btn app-btn--ghost app-btn--sm" onClick={() => setPin(null)}>
                  Remove
                </button>
              </div>
            </div>
          )}
        </section>

        <div className="loc__side">
          <section className="app-panel loc__trip" aria-labelledby="loc-trip-title">
            <div className="app-panel__head">
              <h2 id="loc-trip-title" className="app-panel__title">
                Directions
              </h2>
            </div>
            {isLoaded ? (
              <TripPlanner
                trip={trip}
                onPoint={setPoint}
                onSwap={swap}
                picking={picking}
                onPick={setPicking}
                places={places}
                pin={pin}
                route={route}
                onRoute={setRoute}
                onSelectRoute={(index) => setRoute((r) => (r ? { ...r, index } : r))}
              />
            ) : (
              <p className="app-empty">{loadError ? "Directions need the map." : "Loading…"}</p>
            )}
          </section>

          <section className="app-panel loc__history" aria-labelledby="loc-history-title">
            <div className="app-panel__head">
              <h2 id="loc-history-title" className="app-panel__title">
                Saved places
              </h2>
            </div>

            {loadState === "loading" && (
              <p className="app-empty" role="status">
                Loading your places…
              </p>
            )}

            {loadState === "error" && (
              <div className="app-empty" role="alert">
                <p>Couldn&rsquo;t load your places.</p>
                <button
                  type="button"
                  className="app-btn app-btn--ghost"
                  onClick={() => {
                    setLoadState("loading");
                    reload();
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            {loadState === "ready" && places.length === 0 && (
              <p className="app-empty">
                No places saved yet. Save your location, or drop a pin and save it.
              </p>
            )}

            {loadState === "ready" && places.length > 0 && (
              <ul className="app-list">
                {places.map((loc) => (
                  <li key={loc.id}>
                    <button
                      type="button"
                      className="loc__place"
                      aria-current={loc.id === selectedId ? "true" : undefined}
                      onClick={() => selectPlace(loc)}
                    >
                      <span className="loc__place-top">
                        <span className="loc__place-name">{loc.placeName || "Unknown location"}</span>
                        <span className="loc__place-date">{formatDay(loc.recordedAt)}</span>
                      </span>
                      <span className="loc__coords">
                        {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
