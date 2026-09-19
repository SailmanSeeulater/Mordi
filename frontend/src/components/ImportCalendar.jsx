import { useMemo, useState } from 'react';
import client from '../api/client';
import { parseIcs } from '../lib/ics';
import { COLORS, formatRange, parseLocal } from '../lib/planner';

const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

/**
 * Bringing in a calendar exported from Google, Apple or Outlook (.ics).
 *
 * The file is read in the browser and shown before anything is saved: how
 * many events, over what dates, how many came from repeating events, and the
 * first few. Past events are left out unless asked for, since the planner is
 * about what is coming. Everything imported takes one colour, so the batch
 * stays recognisable next to what was planned here.
 */
export default function ImportCalendar({ text, fileName, onDone, onCancel }) {
  const parsed = useMemo(() => parseIcs(text), [text]);
  const [includePast, setIncludePast] = useState(false);
  const [color, setColor] = useState('sky');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const now = new Date();
  const chosen = includePast ? parsed.events : parsed.events.filter((e) => parseLocal(e.endsAt) >= now);
  const recurring = chosen.filter((e) => e.recurring).length;
  const first = chosen[0];
  const last = chosen[chosen.length - 1];

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await client.post(
        '/api/events/import',
        chosen.map((e) => ({
          title: e.title,
          startsAt: e.startsAt,
          endsAt: e.endsAt,
          allDay: e.allDay,
          placeName: e.placeName,
          notes: e.notes,
          color,
        })),
      );
      onDone(res.data ?? { imported: chosen.length, skipped: 0 });
    } catch (err) {
      setError(err?.response?.data?.error ?? "Couldn't import those events. Check your connection and try again.");
      setBusy(false);
    }
  };

  if (parsed.events.length === 0) {
    return (
      <div className="app-form">
        <p className="import__lead">
          No events found in <strong>{fileName}</strong>
          {parsed.skipped ? `: ${parsed.skipped} entries were cancelled, undated or too long to import.` : '.'}
        </p>
        <p className="app-field__hint">Export an .ics file from your calendar app and try again.</p>
        <div className="app-form__actions">
          <button type="button" className="app-btn" onClick={onCancel}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-form import">
      <p className="import__lead">
        <strong>{chosen.length}</strong> event{chosen.length === 1 ? '' : 's'} from{' '}
        <strong>{parsed.calendarName || fileName}</strong>
        {first && last && (
          <>
            , {dayFormat.format(parseLocal(first.startsAt))} to {dayFormat.format(parseLocal(last.startsAt))}
          </>
        )}
        .{recurring > 0 && ` ${recurring} come from repeating events, expanded over the next year.`}
        {parsed.skipped > 0 && ` ${parsed.skipped} could not be used and will be left out.`}
      </p>

      <ul className="import__list">
        {chosen.slice(0, 6).map((e, i) => (
          <li key={`${e.startsAt}-${i}`} className={`ev--${color}`}>
            <span className="import__when">
              {dayFormat.format(parseLocal(e.startsAt))} &middot; {formatRange(e)}
            </span>
            <span className="import__title">{e.title}</span>
          </li>
        ))}
        {chosen.length > 6 && <li className="import__rest">and {chosen.length - 6} more</li>}
      </ul>

      <label className="app-check">
        <input type="checkbox" checked={includePast} onChange={(e) => setIncludePast(e.target.checked)} />
        Include past events ({parsed.events.length - parsed.events.filter((e) => parseLocal(e.endsAt) >= now).length})
      </label>

      <div className="app-field">
        <span className="app-field__label" id="import-color-label">
          Colour for these events
        </span>
        <div className="event-form__colors" role="radiogroup" aria-labelledby="import-color-label">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              title={c}
              className={`event-swatch ev--${c}`}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>

      {error && (
        <p className="app-form__error" role="alert">
          {error}
        </p>
      )}

      <div className="app-form__actions">
        <button type="button" className="app-btn app-btn--ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="app-btn" onClick={save} disabled={busy || chosen.length === 0}>
          {busy ? 'Importing…' : `Import ${chosen.length} event${chosen.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );
}
