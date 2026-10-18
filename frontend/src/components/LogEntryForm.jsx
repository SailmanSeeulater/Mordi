import { useState } from 'react';
import client from '../api/client';
import { toIsoDate } from '../pages/dashboardData';
import { doneOnDay } from '../lib/entries';
import { goalIcon } from '../lib/categories';
import Select from './Select';
import MoodPicker from './MoodPicker';
import PlaceField from './PlaceField';

const OUTCOMES = [
  { id: true, label: 'Did it' },
  { id: false, label: 'Didn’t do it' },
];

const dayLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

/**
 * One entry for today. Whether it was done is two named choices rather than
 * a checkbox nobody noticed, and a goal already done today says so before
 * saving: a second entry is kept, but the day only ever counts once.
 *
 * `logDate` ("YYYY-MM-DD") logs an earlier day instead, as the calendar does
 * from a planned goal's chip. Without it the form logs today.
 */
export default function LogEntryForm({ goals, behaviors = [], initialGoalId = '', logDate = null, onSaved, onCancel }) {
  const [goalId, setGoalId] = useState(initialGoalId ? String(initialGoalId) : '');
  const [note, setNote] = useState('');
  const [mood, setMood] = useState('good');
  const [completed, setCompleted] = useState(true);
  // A goal can carry a usual place, so picking one offers it straight away.
  const initialGoal = goals.find((g) => String(g.id) === String(initialGoalId));
  const [place, setPlace] = useState(
    initialGoal?.placeName ? { placeName: initialGoal.placeName } : null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const todayIso = toIsoDate(new Date());
  const earlier = Boolean(logDate) && logDate !== todayIso;
  const alreadyDone = completed && doneOnDay(behaviors, goalId, earlier ? logDate : todayIso);

  const goalOptions = [
    { value: '', label: 'Not linked to a goal' },
    ...goals.map((goal) => ({ value: String(goal.id), label: goal.title, icon: goalIcon(goal) })),
  ];

  const pickGoal = (next) => {
    setGoalId(next);
    const goal = goals.find((g) => String(g.id) === next);
    if (!place && goal?.placeName) setPlace({ placeName: goal.placeName });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await client.post('/api/behaviors', {
        goalId: goalId ? Number(goalId) : null,
        note: note.trim(),
        mood,
        completed,
        // Read at submit, so a form opened before midnight still logs today.
        logDate: earlier ? logDate : toIsoDate(new Date()),
        latitude: place?.latitude ?? null,
        longitude: place?.longitude ?? null,
        placeName: place?.placeName || null,
      });
      onSaved();
    } catch {
      setError('Couldn’t save that entry. Check your connection and try again.');
      setSaving(false);
    }
  };

  return (
    <form className="app-form" onSubmit={submit}>
      <div className="app-field">
        <label htmlFor="log-note">What did you do?</label>
        <input
          id="log-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ran 3 miles before work"
          required
          maxLength={255}
        />
      </div>

      {goals.length > 0 && (
        <div className="app-field">
          <span className="app-field__label" id="log-goal-label">
            Goal
          </span>
          <Select
            id="log-goal"
            labelledBy="log-goal-label"
            value={goalId}
            options={goalOptions}
            onChange={pickGoal}
          />
        </div>
      )}

      <div className="app-field">
        <span className="app-field__label" id="log-mood-label">
          Mood
        </span>
        <MoodPicker value={mood} onChange={setMood} labelledBy="log-mood-label" />
      </div>

      <PlaceField id="log-place-label" label="Where" value={place} onChange={setPlace} />

      <div className="app-field">
        <span className="app-field__label" id="log-outcome-label">
          {earlier ? dayLabel.format(new Date(`${logDate}T00:00:00`)) : 'Today'}
        </span>
        <div className="app-segments" role="group" aria-labelledby="log-outcome-label">
          <span
            className="app-segments__thumb"
            style={{ '--n': OUTCOMES.length, '--i': completed ? 0 : 1 }}
            aria-hidden="true"
          />
          {OUTCOMES.map((o) => (
            <button
              key={o.label}
              type="button"
              className="app-segment"
              aria-pressed={completed === o.id}
              aria-describedby={!o.id && !completed ? 'log-outcome-hint' : undefined}
              onClick={() => setCompleted(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
        {!completed && (
          <p className="app-field__hint" id="log-outcome-hint">
            Saved as a note for {earlier ? 'that day' : 'today'}. It doesn’t count toward the goal.
          </p>
        )}
      </div>

      {/* Always in the page, so the note is announced when it appears. */}
      <div role="status">
        {alreadyDone && (
          <p className="app-field__hint log-form__repeat">
            {earlier
              ? 'Already logged that day. Saving adds a note to it; it won’t count twice.'
              : 'Already logged today. Saving adds a note to today; it won’t count twice.'}
          </p>
        )}
      </div>

      {error && (
        <p className="app-form__error" role="alert">
          {error}
        </p>
      )}

      <div className="app-form__actions">
        <button type="button" className="app-btn app-btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="app-btn" disabled={saving}>
          {saving ? 'Saving…' : 'Save entry'}
        </button>
      </div>
    </form>
  );
}
