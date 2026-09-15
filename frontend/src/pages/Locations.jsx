import { useCallback, useEffect, useMemo, useState } from "react";
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from "@react-google-maps/api";
import useDocumentTitle from "../hooks/useDocumentTitle";
import client from "../api/client";
import AppShell from "../components/AppShell";
import "./locations.css";

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const DEFAULT_CENTER = { lat: 32.7157, lng: -117.1611 };
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

// Google Maps styles only accept hex, so these mirror the tokens in index.css.
const PALETTE = {
  bg: "#ece7dd",
  surface: "#e4ddd0",
  text: "#1a1714",
  muted: "#595550",
  accent: "#d2452a",
};

const MAP_OPTIONS = {
  disableDefaultUI: true,
  zoomControl: true,
  clickableIcons: false,
  styles: [
    { elementType: "geometry", stylers: [{ color: PALETTE.bg }] },
    { elementType: "labels.text.fill", stylers: [{ color: PALETTE.muted }] },
    { elementType: "labels.text.stroke", stylers: [{ color: PALETTE.bg }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: PALETTE.surface }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#f6f2ea" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#d6cdbd" }] },
    { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#cbd1cb" }] },
    { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#b8ae9f" }] },
  ],
};

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

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
  useDocumentTitle("Locations");

  const [locations, setLocations] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [status, setStatus] = useState({ tone: "info", text: "" });

  const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: MAPS_KEY });

  useEffect(() => {
    let cancelled = false;
    client
      .get("/api/locations")
      .then((res) => {
        if (cancelled) return;
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
  // Stable object so the map only re-centers when the focused place changes.
  const center = useMemo(() => {
    const focus = places.find((p) => p.id === selectedId) ?? places[0];
    return focus ? { lat: focus.latitude, lng: focus.longitude } : DEFAULT_CENTER;
  }, [places, selectedId]);

  const markerIcon = useMemo(
    () =>
      isLoaded
        ? {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: PALETTE.accent,
            fillOpacity: 1,
            strokeColor: PALETTE.text,
            strokeWeight: 2,
          }
        : undefined,
    [isLoaded],
  );

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
      reload();
    } catch {
      setStatus({ tone: "error", text: "Couldn't save this place. Check your connection and try again." });
    } finally {
      setCapturing(false);
    }
  };

  return (
    <AppShell>
      <div className="loc">
        <section className="app-panel loc__map-panel" aria-labelledby="loc-title">
          <div className="app-panel__head">
            <h1 id="loc-title" className="app-panel__title">
              Places
            </h1>
            {loadState === "ready" && (
              <span className="app-panel__meta">{places.length} saved</span>
            )}
            <div className="app-panel__spacer" />
            <button
              type="button"
              className="app-btn"
              onClick={captureLocation}
              disabled={capturing}
            >
              {capturing ? "Finding you…" : "Save my location"}
            </button>
          </div>

          <div role="status">
            {status.text && (
              <p className={"loc__status" + (status.tone === "error" ? " loc__status--error" : "")}>
                {status.text}
              </p>
            )}
          </div>

          <div className="loc__map">
            {loadError ? (
              <p className="app-empty">The map couldn&rsquo;t load. Your saved places are still listed.</p>
            ) : !isLoaded ? (
              <p className="app-empty">Loading map…</p>
            ) : (
              <GoogleMap
                mapContainerStyle={MAP_CONTAINER_STYLE}
                center={center}
                zoom={12}
                options={MAP_OPTIONS}
              >
                {places.map((loc) => (
                  <MarkerF
                    key={loc.id}
                    position={{ lat: loc.latitude, lng: loc.longitude }}
                    icon={markerIcon}
                    title={loc.placeName || "Saved place"}
                    onClick={() => setSelectedId(loc.id)}
                  />
                ))}
                {selected && (
                  <InfoWindowF
                    position={{ lat: selected.latitude, lng: selected.longitude }}
                    onCloseClick={() => setSelectedId(null)}
                  >
                    <div className="loc__info">
                      <strong>{selected.placeName || "Unknown location"}</strong>
                      <span>{formatDay(selected.recordedAt)}</span>
                    </div>
                  </InfoWindowF>
                )}
              </GoogleMap>
            )}
          </div>
        </section>

        <section className="app-panel loc__history" aria-labelledby="loc-history-title">
          <div className="app-panel__head">
            <h2 id="loc-history-title" className="app-panel__title">
              History
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
              No places saved yet. Save your location and it will show up here and on the map.
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
                    onClick={() => setSelectedId(loc.id)}
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
    </AppShell>
  );
}
