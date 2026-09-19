import { useState } from 'react';
import { COLORS, addDays, isoDate, parseLocal } from '../lib/planner';

const pad = (n) => String(n).padStart(2, '0');
const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/**
 * Creates or edits one planned event. An all-day event's end date is shown
 * inclusively ("Sep 18 to Sep 18" is one day) and stored exclusively
 * (midnight after the last day), which is what the API and the grid use.
 */
export default function EventForm({ event, draft, onSave, onDelete, onCancel }) {
  const source = event ?? draft;
  const s = parseLocal(source.startsAt);
  const e = parseLocal(source.endsAt);
  const inclusiveEnd = source.allDay ? addDays(e, -1) : e;

  const [title, setTitle] = useState(event?.title ?? '');
  const [allDay, setAllDay] = useState(Boolean(source.allDay));
  const [startDate, setStartDate] = useState(isoDate(s));
  const [startTime, setStartTime] = useState(hhmm(s));
  const [endDate, setEndDate] = useState(isoDate(inclusiveEnd));
  const [endTime, setEndTime] = useState(hhmm(e));
  const [color, setColor] = useState(event?.color ?? 'accent');
  const [placeName, setPlaceName] = useState(event?.placeName ?? '');
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (ev) => {
    ev.preventDefault();
    if (!title.trim()) {
      setError('Give it a title.');
      return;
    }
    const startsAt = allDay ? `${startDate}T00:00:00` : `${startDate}T${startTime}:00`;
    const endsAt = allDay
      ? `${isoDate(addDays(parseLocal(`${endDate}T00:00:00`), 1))}T00:00:00`
      : `${endDate}T${endTime}:00`;
    if (parseLocal(endsAt) <= parseLocal(startsAt)) {
      setError('It has to end after it starts.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({ title: title.trim(), allDay, startsAt, endsAt, color, placeName, notes });
    } catch (err) {
      setError(err?.response?.data?.error ?? "Couldn't save that. Check your connection and try again.");
      setSaving(false);
    }
  };

  return (
    <form className="app-form event-form" onSubmit={submit}>
      <div className="app-field">
        <label htmlFor="event-title">Title</label>
        <input
          id="event-title"
          value={title}
          onChange={(x) => setTitle(x.target.value)}
          placeholder="Gym, dentist, deep work…"
          maxLength={120}
          autoFocus
        />
      </div>

      <label className="app-check">
        <input type="checkbox" checked={allDay} onChange={(x) => setAllDay(x.target.checked)} />
        All day
      </label>

      <div className="event-form__when">
        <div className="app-field">
          <label htmlFor="event-start-date">Starts</label>
          <div className="event-form__pair">
            <input id="event-start-date" type="date" value={startDate} onChange={(x) => setStartDate(x.target.value)} required />
            {!allDay && (
              <input aria-label="Start time" type="time" step="900" value={startTime} onChange={(x) => setStartTime(x.target.value)} required />
            )}
          </div>
        </div>
        <div className="app-field">
          <label htmlFor="event-end-date">Ends</label>
          <div className="event-form__pair">
            <input id="event-end-date" type="date" value={endDate} onChange={(x) => setEndDate(x.target.value)} required />
            {!allDay && (
              <input aria-label="End time" type="time" step="900" value={endTime} onChange={(x) => setEndTime(x.target.value)} required />
            )}
          </div>
        </div>
      </div>

      <div className="app-field">
        <span className="app-field__label" id="event-color-label">Colour</span>
        <div className="event-form__colors" role="radiogroup" aria-labelledby="event-color-label">
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

      <div className="app-field">
        <label htmlFor="event-place">Place</label>
        <input id="event-place" value={placeName} onChange={(x) => setPlaceName(x.target.value)} placeholder="Optional" maxLength={255} />
      </div>

      <div className="app-field">
        <label htmlFor="event-notes">Notes</label>
        <textarea id="event-notes" value={notes} onChange={(x) => setNotes(x.target.value)} rows={3} maxLength={1000} placeholder="Optional" />
      </div>

      {error && (
        <p className="app-form__error" role="alert">
          {error}
        </p>
      )}

      <div className="app-form__actions">
        {event && (
          <button type="button" className="app-btn app-btn--ghost event-form__delete" onClick={onDelete} disabled={saving}>
            Delete
          </button>
        )}
        <button type="button" className="app-btn app-btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="app-btn" disabled={saving}>
          {saving ? 'Saving…' : event ? 'Save' : 'Add to calendar'}
        </button>
      </div>
    </form>
  );
}
