import { useCallback, useEffect, useRef, useState } from 'react';
import { capturePlace, readCachedPlace } from '../lib/geo';

/* Open-Meteo: no key, no account, and it does not set cookies. The only thing
   that leaves the browser is a rounded pair of coordinates. */
const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

/* Weather is read at most every ten minutes; anything fresher is noise. */
const MAX_AGE_MS = 10 * 60 * 1000;
const CACHE_KEY = 'mordi-weather';

/** WMO codes, grouped into the six states worth drawing. */
export function weatherKind(code) {
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly';
  if (code === 3) return 'cloud';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 71 && code <= 77) return 'snow';
  if (code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  if (code >= 51 && code <= 67) return 'rain';
  if (code >= 80 && code <= 82) return 'rain';
  return 'cloud';
}

export const WEATHER_LABEL = {
  clear: 'Clear',
  partly: 'Part cloud',
  cloud: 'Cloudy',
  fog: 'Fog',
  rain: 'Rain',
  snow: 'Snow',
  storm: 'Storms',
};

/**
 * Fahrenheit where it is the everyday unit, Celsius everywhere else. Read from
 * the browser's own region rather than asked for.
 */
export function unitForLocale(locale = typeof navigator !== 'undefined' ? navigator.language : '') {
  const region = String(locale).split('-')[1]?.toUpperCase();
  return ['US', 'LR', 'MM', 'BS', 'BZ', 'KY', 'PW', 'FM', 'MH'].includes(region)
    ? 'fahrenheit'
    : 'celsius';
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    return Date.now() - cached.at < MAX_AGE_MS ? cached.weather : null;
  } catch {
    return null;
  }
}

function writeCache(weather) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), weather }));
  } catch {
    // Private windows throw. A missing cache only costs one extra request.
  }
}

async function fetchWeather(place, unit) {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: 'temperature_2m,weather_code,is_day',
    daily: 'temperature_2m_max,temperature_2m_min',
    temperature_unit: unit,
    timezone: 'auto',
    forecast_days: '1',
  });
  const res = await fetch(`${ENDPOINT}?${params}`);
  if (!res.ok) throw new Error(`weather ${res.status}`);
  const data = await res.json();
  const current = data?.current;
  if (!current || typeof current.temperature_2m !== 'number') {
    throw new Error('weather payload');
  }
  return {
    temperature: Math.round(current.temperature_2m),
    high: Math.round(data.daily?.temperature_2m_max?.[0] ?? current.temperature_2m),
    low: Math.round(data.daily?.temperature_2m_min?.[0] ?? current.temperature_2m),
    unit: unit === 'fahrenheit' ? '°F' : '°C',
    kind: weatherKind(current.weather_code),
    isDay: current.is_day !== 0,
    placeName: place.placeName || '',
  };
}

/**
 * Today's weather for wherever the person last was.
 *
 * It never asks the browser for a position on its own: if no place has been
 * captured yet the state is 'idle' and the caller offers a button, which calls
 * `enable`. A dashboard that pops a location prompt the moment it loads is
 * asking for something the person did not request.
 *
 * States: 'idle' | 'loading' | 'ready' | 'error'.
 */
export default function useWeather() {
  // Read the cache once, as initial state. Doing it in an effect would mean a
  // first paint that says "no weather" followed immediately by one that does.
  const [cached] = useState(readCache);
  const [weather, setWeather] = useState(cached);
  const [state, setState] = useState(cached ? 'ready' : 'idle');
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** Used by the click paths, where showing a loading state is the point. */
  const load = useCallback(async (place) => {
    setState('loading');
    try {
      const next = await fetchWeather(place, unitForLocale());
      if (!alive.current) return;
      writeCache(next);
      setWeather(next);
      setState('ready');
    } catch {
      if (alive.current) setState('error');
    }
  }, []);

  // A place captured earlier is enough to fetch without asking again. Nothing
  // is set synchronously here, so the first render is not followed by a
  // cascade.
  useEffect(() => {
    if (cached) return undefined;
    const place = readCachedPlace();
    if (!place) return undefined;

    let cancelled = false;
    fetchWeather(place, unitForLocale())
      .then((next) => {
        if (cancelled) return;
        writeCache(next);
        setWeather(next);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [cached]);

  /** Asks for a position, then the weather for it. Called from a real click. */
  const enable = useCallback(async () => {
    setState('loading');
    try {
      await load(await capturePlace());
    } catch {
      if (alive.current) setState('error');
    }
  }, [load]);

  const refresh = useCallback(() => {
    const place = readCachedPlace();
    if (place) load(place);
    else enable();
  }, [load, enable]);

  return { weather, state, enable, refresh };
}
