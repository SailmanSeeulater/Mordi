import { useState, useEffect, useCallback } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  InfoWindow,
} from "@react-google-maps/api";
import client from "../api/client";
import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const mapContainerStyle = {
  width: "100%",
  height: "400px",
  borderRadius: "12px",
};
const defaultCenter = { lat: 32.7157, lng: -117.1611 };

export default function Locations() {
  const [locations, setLocations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("");
  const [map, setMap] = useState(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    const res = await client.get("/api/locations");
    setLocations(res.data);
  };

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setStatus("Geolocation not supported by your browser");
      return;
    }
    setStatus("Capturing location...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const placeName = await reverseGeocode(latitude, longitude);
        await client.post("/api/locations", {
          latitude,
          longitude,
          placeName,
        });
        setStatus(`Location captured: ${placeName}`);
        fetchLocations();
      },
      () => setStatus("Unable to retrieve your location"),
    );
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`,
      );
      const data = await res.json();
      return data.results[0]?.formatted_address || "Unknown location";
    } catch {
      return "Unknown location";
    }
  };

  const onLoad = useCallback((mapInstance) => setMap(mapInstance), []);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.logo}>Mordi</h1>
      </div>

      <div style={styles.content}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Location Tracker</h2>
          <button style={styles.button} onClick={captureLocation}>
            📍 Capture My Location
          </button>
          {status && <p style={styles.status}>{status}</p>}
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Location Map</h2>
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={
                locations.length > 0
                  ? { lat: locations[0].latitude, lng: locations[0].longitude }
                  : defaultCenter
              }
              zoom={12}
              onLoad={onLoad}
              options={{ styles: darkMapStyle }}
            >
              {locations.map((loc) => (
                <Marker
                  key={loc.id}
                  position={{ lat: loc.latitude, lng: loc.longitude }}
                  onClick={() => setSelected(loc)}
                />
              ))}
              {selected && (
                <InfoWindow
                  position={{ lat: selected.latitude, lng: selected.longitude }}
                  onCloseClick={() => setSelected(null)}
                >
                  <div style={{ color: "#000" }}>
                    <p>
                      <strong>{selected.placeName}</strong>
                    </p>
                    <p>{new Date(selected.recordedAt).toLocaleString()}</p>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          ) : (
            <p style={styles.status}>Loading map...</p>
          )}
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Location History</h2>
          <div style={styles.list}>
            {locations.map((loc) => (
              <div key={loc.id} style={styles.listItem}>
                <div>
                  <p style={styles.placeName}>{loc.placeName || "Unknown"}</p>
                  <p style={styles.coords}>
                    {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                  </p>
                </div>
                <span style={styles.time}>
                  {new Date(loc.recordedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#484848" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#000000" }],
  },
];

const styles = {
  container: { minHeight: "100vh", background: "#0f0f0f" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1.5rem 2rem",
    borderBottom: "1px solid #2a2a2a",
    background: "#1a1a1a",
  },
  logo: { color: "#6c63ff", margin: 0, fontSize: "1.5rem" },
  content: {
    padding: "2rem",
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
  },
  card: {
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: "12px",
    padding: "1.5rem",
  },
  cardTitle: {
    color: "#fff",
    fontSize: "1.1rem",
    fontWeight: "600",
    marginTop: 0,
    marginBottom: "1.5rem",
  },
  button: {
    padding: "0.75rem 1.5rem",
    background: "#6c63ff",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "1rem",
    fontWeight: "600",
    cursor: "pointer",
  },
  status: { color: "#888", marginTop: "1rem", fontSize: "0.9rem" },
  list: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  listItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.75rem",
    background: "#2a2a2a",
    borderRadius: "8px",
  },
  placeName: { color: "#fff", margin: 0, fontSize: "0.9rem" },
  coords: {
    color: "#888",
    margin: 0,
    fontSize: "0.75rem",
    marginTop: "0.25rem",
  },
  time: { color: "#6c63ff", fontSize: "0.8rem" },
};
