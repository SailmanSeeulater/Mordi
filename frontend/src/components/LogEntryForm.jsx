import { useState } from 'react';
import client from '../api/client';
import { toIsoDate } from '../pages/dashboardData';
import Select from './Select';
import MoodPicker from './MoodPicker';
import PlaceField from './PlaceField';

export default function LogEntryForm({ goals, initialGoalId = '', onSaved, onCancel }) {
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

  const goalOptions = [
    { value: '', label: 'Not linked to a goal' },
    ...goals.map((goal) => ({ value: String(goal.id), label: goal.title })),
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
        logDate: toIsoDate(new Date()),
        latitude: place?.latitude ?? null,
        longitude: place?.longitude ?? null,
        placeName: place?.placeName || null,
      });
      onSaved();
    } catch {
      setError("Couldn't save that entry. Check your connection and try again.");
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

      <label className="app-check">
        <input
          type="checkbox"
          checked={completed}
          onChange={(e) => setCompleted(e.target.checked)}
        />
        I did it today
      </label>

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
