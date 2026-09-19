import { useEffect, useRef, useState } from 'react';
import Select from './Select';
import { RoutingBlockedError, computeTrip, formatArrival, formatSeconds } from '../lib/routes';

const icon = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

const MODES = [
  {
    id: 'DRIVING',
    label: 'Drive',
    icon: (
      <svg {...icon}>
        <path d="M5 16V11l2-5h10l2 5v5M5 16h14M5 16v2M19 16v2" />
        <circle cx="8" cy="13.5" r="0.6" />
        <circle cx="16" cy="13.5" r="0.6" />
      </svg>
    ),
  },
  {
    id: 'TRANSIT',
    label: 'Transit',
    icon: (
      <svg {...icon}>
        <rect x="6" y="3.5" width="12" height="14" rx="3" />
        <path d="M6 11h12M9 20.5l1.5-3M15 20.5l-1.5-3" />
        <circle cx="9.5" cy="14.3" r="0.6" />
        <circle cx="14.5" cy="14.3" r="0.6" />
      </svg>
    ),
  },
  {
    id: 'WALKING',
    label: 'Walk',
    icon: (
      <svg {...icon}>
        <circle cx="13" cy="4.5" r="1.8" />
        <path d="M11 21l2-6-2.5-2.5L12 8l3 3.5 2.5 1M10 8.5L7.5 11 7 14" />
      </svg>
    ),
  },
  {
    id: 'BICYCLING',
    label: 'Bike',
    icon: (
      <svg {...icon}>
        <circle cx="6" cy="16" r="3.5" />
        <circle cx="18" cy="16" r="3.5" />
        <path d="M6 16l4-7h5l3 7M10 9L8.5 6H7M14 6h2" />
      </svg>
    ),
  },
];

function getPosition() {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 15000 },
    ),
  );
}

/** "Today 5:40 PM" as a Date: the next occurrence of HH:mm. */
function nextAt(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d < new Date()) d.setDate(d.getDate() + 1);
  return d;
}

/**
 * A trip, the way a maps app plans one.
 *
 * A (where from) and B (where to) stack on a rail with a swap button beside
 * them, as in Google Maps. Either end can be your location, the dropped pin,
 * a saved place, or a point picked straight off the map. As soon as both ends
 * are known every travel mode is asked at once, so each mode shows its own
 * travel time before you choose one, and the chosen mode's routes are drawn.
 * Nothing waits for a "Go" button: change an end, a mode or the departure
 * time and the answer follows.
 */
export default function TripPlanner({ trip, onPoint, onSwap, picking, onPick, places, pin, route, onRoute, onSelectRoute }) {
  const [mode, setMode] = useState('DRIVING');
  const [leave, setLeave] = useState('');
  const [byMode, setByMode] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ticket = useRef(0);

  const endOptions = (which) => {
    const current = trip[which];
    return [
      ...(which === 'a' ? [{ value: 'me', label: 'Your location' }] : []),
      ...(current?.kind === 'map' ? [{ value: `map:${which}`, label: current.label }] : []),
      ...(pin ? [{ value: 'pin', label: `Dropped pin · ${pin.label}` }] : []),
      ...places.map((p) => ({ value: `loc:${p.id}`, label: p.placeName || 'Saved place' })),
    ];
  };

  const valueOf = (point, which) => {
    if (!point) return '';
    if (point.kind === 'me') return 'me';
    if (point.kind === 'pin') return 'pin';
    if (point.kind === 'place') return `loc:${point.id}`;
    return `map:${which}`;
  };

  const choose = (which, value) => {
    if (value === 'me') onPoint(which, { kind: 'me', label: 'Your location' });
    else if (value === 'pin' && pin) onPoint(which, { kind: 'pin', label: pin.label, position: pin.position });
    else if (value.startsWith('loc:')) {
      const place = places.find((p) => `loc:${p.id}` === value);
      if (place) {
        onPoint(which, {
          kind: 'place',
          id: place.id,
          label: place.placeName || 'Saved place',
          position: { lat: place.latitude, lng: place.longitude },
        });
      }
    }
  };

  const aKey = trip.a ? `${trip.a.kind}:${trip.a.position?.lat},${trip.a.position?.lng}` : '';
  const bKey = trip.b ? `${trip.b.kind}:${trip.b.position?.lat},${trip.b.position?.lng}` : '';

  // Ask every mode as soon as both ends are known, and again whenever an end
  // or the departure time changes. Responses for an older question are
  // dropped, so a quick swap never shows the previous trip's times.
  useEffect(() => {
    if (!trip.a || !trip.b) return undefined;
    const mine = ++ticket.current;
    const run = async () => {
      setBusy(true);
      setError('');
      let origin = trip.a.position;
      try {
        if (!origin && trip.a.kind === 'me') origin = await getPosition();
      } catch {
        if (mine === ticket.current) {
          setBusy(false);
          setError("Couldn't get your location. Allow location access, or start from a saved place.");
        }
        return;
      }
      const destination = trip.b.position;
      const departure = leave ? nextAt(leave) : new Date();
      const results = await Promise.allSettled(
        MODES.map((m) => computeTrip({ origin, destination, mode: m.id, departure })),
      );
      if (mine !== ticket.current) return;
      const next = {};
      let blocked = false;
      MODES.forEach((m, i) => {
        const r = results[i];
        if (r.status === 'fulfilled') next[m.id] = { routes: r.value, departure, origin, destination };
        else if (r.reason instanceof RoutingBlockedError) blocked = true;
      });
      setByMode(next);
      setBusy(false);
      if (blocked && Object.keys(next).length === 0) {
        setError('Routes are blocked for this map key. In Google Cloud Console, open Credentials, pick the key, and add "Routes API" to its API restrictions.');
      }
    };
    run();
    return undefined;
    // aKey/bKey stand in for the two ends: the objects change identity on
    // every parent render, the places they describe do not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aKey, bKey, leave]);

  // Draw the chosen mode's routes; clear the map when there is nothing to draw.
  const chosen = byMode[mode];
  useEffect(() => {
    if (chosen?.routes?.length) onRoute({ ...chosen, mode, index: 0 });
    else onRoute(null);
    // onRoute is a state setter from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen, mode]);

  const end = (which) => {
    const letter = which === 'a' ? 'A' : 'B';
    const label = which === 'a' ? 'Starting point' : 'Destination';
    const options = endOptions(which);
    const value = valueOf(trip[which], which);
    return (
      <div className="trip__end">
        <span className="app-sr" id={`trip-${which}-label`}>{label}</span>
        {options.length ? (
          <Select
            id={`trip-${which}`}
            labelledBy={`trip-${which}-label`}
            value={value}
            options={value ? options : [{ value: '', label: which === 'a' ? 'Choose a start' : 'Choose destination' }, ...options]}
            onChange={(v) => choose(which, v)}
          />
        ) : (
          <p className="trip__placeholder">{which === 'b' ? 'Tap the map or search a place' : 'Your location'}</p>
        )}
        <button
          type="button"
          className={`trip__pick${picking === which ? ' trip__pick--on' : ''}`}
          aria-pressed={picking === which}
          onClick={() => onPick(picking === which ? null : which)}
          title={`Pick ${letter} on the map`}
        >
          <svg {...icon} width={16} height={16}>
            <path d="M12 21s-6-5.3-6-10a6 6 0 0112 0c0 4.7-6 10-6 10z" />
            <circle cx="12" cy="11" r="2.2" />
          </svg>
          <span className="app-sr">{`Pick ${letter} on the map`}</span>
        </button>
      </div>
    );
  };

  const selected = route?.routes?.[route.index];

  return (
    <div className="trip">
      <div className="trip__ends">
        <div className="trip__rail" aria-hidden="true">
          <span className="trip__dot trip__dot--a" />
          <span className="trip__line" />
          <span className="trip__dot trip__dot--b" />
        </div>
        <div className="trip__fields">
          {end('a')}
          {end('b')}
        </div>
        <button type="button" className="app-iconbtn trip__swap" onClick={onSwap} aria-label="Swap start and destination" title="Swap">
          <svg {...icon}>
            <path d="M8 4v16M8 4L4.5 7.5M8 4l3.5 3.5M16 20V4M16 20l-3.5-3.5M16 20l3.5-3.5" />
          </svg>
        </button>
      </div>

      {picking && (
        <p className="trip__picking" role="status">
          Tap the map to set {picking === 'a' ? 'the starting point' : 'the destination'}.
        </p>
      )}

      <div className="trip__modes" role="radiogroup" aria-label="Travel mode">
        {MODES.map((m) => {
          const r = byMode[m.id]?.routes?.[0];
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              className="trip__mode"
              onClick={() => setMode(m.id)}
            >
              {m.icon}
              <span className="trip__mode-name">{m.label}</span>
              <span className="trip__mode-time">
                {busy ? '…' : r ? r.durationText ?? formatSeconds(r.seconds) : trip.a && trip.b ? '—' : ''}
              </span>
            </button>
          );
        })}
      </div>

      <div className="trip__when">
        <div className="app-segments trip__leave-mode" role="group" aria-label="Departure">
          <span className="app-segments__thumb" style={{ '--n': 2, '--i': leave ? 1 : 0 }} aria-hidden="true" />
          <button type="button" className="app-segment" aria-pressed={!leave} onClick={() => setLeave('')}>
            Leave now
          </button>
          <button
            type="button"
            className="app-segment"
            aria-pressed={Boolean(leave)}
            onClick={() => {
              if (leave) return;
              const d = new Date(Date.now() + 30 * 60_000);
              setLeave(`${String(d.getHours()).padStart(2, '0')}:${String(Math.floor(d.getMinutes() / 15) * 15).padStart(2, '0')}`);
            }}
          >
            Leave at
          </button>
        </div>
        {leave && (
          <input
            className="trip__time"
            type="time"
            step="900"
            value={leave}
            onChange={(e) => setLeave(e.target.value)}
            aria-label="Departure time"
          />
        )}
      </div>

      {error && (
        <p className="app-form__error" role="alert">
          {error}
        </p>
      )}

      {!trip.b && !error && (
        <p className="trip__hint">Tap the map to drop a pin, then choose Directions to here. Or pick B on the map directly.</p>
      )}

      {selected && (
        <div className="trip__result" aria-live="polite">
          <p className="trip__eta">
            <strong>{selected.durationText ?? formatSeconds(selected.seconds)}</strong>
            <span>{selected.distanceText}</span>
          </p>
          <p className="trip__arrive">
            Arrive around {formatArrival(route.departure, selected.seconds)}
            {selected.summary ? ` · via ${selected.summary}` : ''}
          </p>
          {route.routes.length > 1 && (
            <ol className="trip__routes" aria-label="Other routes">
              {route.routes.map((r, i) => (
                <li key={`${r.summary}-${i}`}>
                  <button type="button" className="trip__route" aria-pressed={route.index === i} onClick={() => onSelectRoute(i)}>
                    <strong>{r.durationText ?? formatSeconds(r.seconds)}</strong>
                    <span>{r.summary ? `via ${r.summary}` : `Route ${i + 1}`}</span>
                    <span>{r.distanceText}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
