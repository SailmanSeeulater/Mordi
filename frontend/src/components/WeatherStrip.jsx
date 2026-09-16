import useWeather, { WEATHER_LABEL } from '../hooks/useWeather';
import WeatherGlyph from './WeatherGlyph';

/**
 * Today's weather, on the week card.
 *
 * It belongs there because it is the same question as the rest of the card —
 * what is this week actually like — and because a missed run reads differently
 * in a thunderstorm. Nothing is fetched until a place is known, and the only
 * way to establish one is the button below, pressed on purpose.
 */
export default function WeatherStrip() {
  const { weather, state, enable } = useWeather();

  if (state === 'idle' || (state === 'error' && !weather)) {
    return (
      <div className="wx wx--offer">
        <button type="button" className="pass__cta pass__cta--quiet wx__enable" onClick={enable}>
          {state === 'error' ? 'Try weather again' : 'Show weather'}
        </button>
        <p className="wx__note">Uses your location once, and remembers it on this device.</p>
      </div>
    );
  }

  if (!weather) {
    return (
      <p className="wx wx--waiting" role="status">
        Checking the weather…
      </p>
    );
  }

  const label = WEATHER_LABEL[weather.kind] ?? 'Weather';

  return (
    <div className="wx">
      <span className="wx__glyph">
        <WeatherGlyph kind={weather.kind} isDay={weather.isDay} idSuffix="-pass" />
      </span>
      <p className="wx__temp">
        {weather.temperature}
        <small>{weather.unit}</small>
      </p>
      <div className="wx__lines">
        <span className="wx__label">{label}</span>
        <span className="wx__range">
          {weather.high}
          {' / '}
          {weather.low}
          <span className="app-sr"> high and low today</span>
        </span>
        {weather.placeName && <span className="wx__place">{weather.placeName}</span>}
      </div>
    </div>
  );
}
