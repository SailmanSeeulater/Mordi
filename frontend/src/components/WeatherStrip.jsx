import useWeather, { WEATHER_LABEL } from '../hooks/useWeather';
import WeatherGlyph from './WeatherGlyph';

/**
 * Today's weather, as a chip in the corner of the week card.
 *
 * It belongs on that card because it is the same question as the rest of it —
 * what is this week actually like — and because a missed run reads differently
 * in a thunderstorm. It is deliberately the size of a day chip: a glyph and a
 * temperature, with everything else in the accessible name rather than on
 * screen, so it sits beside the week's numbers without competing with them.
 *
 * Nothing is fetched until a place is known, and the only way to establish one
 * is the button, pressed on purpose.
 */
export default function WeatherStrip() {
  const { weather, state, enable } = useWeather();

  if (state === 'idle' || (state === 'error' && !weather)) {
    return (
      <button
        type="button"
        className="wx wx--btn"
        onClick={enable}
        title="Uses your location once, and remembers it on this device"
      >
        <WeatherGlyph kind="partly" size={16} idSuffix="-offer" />
        {state === 'error' ? 'Retry' : 'Weather'}
      </button>
    );
  }

  if (!weather) {
    return (
      <span className="wx wx--wait" role="status">
        Checking…
      </span>
    );
  }

  const label = WEATHER_LABEL[weather.kind] ?? 'Weather';
  const detail =
    `${label}, ${weather.temperature}${weather.unit}, ` +
    `high ${weather.high}, low ${weather.low}` +
    (weather.placeName ? `, ${weather.placeName}` : '');

  return (
    <span className="wx" title={detail}>
      <WeatherGlyph kind={weather.kind} isDay={weather.isDay} size={18} idSuffix="-pass" />
      <span aria-hidden="true">
        {weather.temperature}
        <small>°</small>
      </span>
      <span className="app-sr">{detail}</span>
    </span>
  );
}
