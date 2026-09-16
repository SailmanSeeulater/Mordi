import { useState } from 'react';
import { capturePlace, readCachedPlace } from '../lib/geo';

const IconPin = () => (
  <svg
    className="app-place__icon"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z" />
    <circle cx="12" cy="10" r="2.8" />
  </svg>
);

/**
 * Optional "where were you" control for a log entry or a goal.
 *
 * Nothing is captured until the button is pressed: a form that asks the
 * browser for coordinates the moment it opens is a permission prompt the
 * person did not ask for. A previously captured place is offered for reuse so
 * the common case is one tap, not a fresh fix.
 *
 * `value` is `{ latitude, longitude, placeName } | null`.
 */
export default function PlaceField({ value, onChange, id, label = 'Where' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cached = readCachedPlace();

  const capture = async () => {
    setBusy(true);
    setError('');
    try {
      onChange(await capturePlace());
    } catch {
      setError('Location unavailable. Check the site permission in your browser.');
    }
    setBusy(false);
  };

  const text = value?.placeName
    ? value.placeName
    : value
      ? `${value.latitude}, ${value.longitude}`
      : 'Not attached';

  return (
    <div className="app-field">
      <span className="app-field__label" id={id}>
        {label}
      </span>
      <div className="app-place">
        <IconPin />
        <span
          className={`app-place__text${value ? '' : ' app-place__text--empty'}`}
          aria-describedby={id}
        >
          {text}
        </span>
        <span className="app-place__actions">
          {value ? (
            <button
              type="button"
              className="app-btn app-btn--quiet app-btn--sm"
              onClick={() => onChange(null)}
            >
              Remove
            </button>
          ) : (
            <>
              {cached && (
                <button
                  type="button"
                  className="app-btn app-btn--quiet app-btn--sm"
                  onClick={() => onChange(cached)}
                >
                  Last place
                </button>
              )}
              <button
                type="button"
                className="app-btn app-btn--quiet app-btn--sm"
                onClick={capture}
                disabled={busy}
              >
                {busy ? 'Locating…' : 'Use my location'}
              </button>
            </>
          )}
        </span>
      </div>
      {error && (
        <p className="app-field__hint" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
