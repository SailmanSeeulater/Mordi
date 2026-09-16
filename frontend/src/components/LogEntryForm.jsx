import { useState } from 'react';
import client from '../api/client';
import { toIsoDate } from '../pages/dashboardData';

const MOODS = ['great', 'good', 'neutral', 'bad', 'terrible'];
const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');

export default function LogEntryForm({ goals, initialGoalId = '', onSaved, onCancel }) {
  const [goalId, setGoalId] = useState(initialGoalId ? String(initialGoalId) : '');
  const [note, setNote] = useState('');
  const [mood, setMood] = useState('good');
  const [completed, setCompleted] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
          <label htmlFor="log-goal">Goal</label>
          <select id="log-goal" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">Not linked to a goal</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="app-field">
        <label htmlFor="log-mood">Mood</label>
        <select id="log-mood" value={mood} onChange={(e) => setMood(e.target.value)}>
          {MOODS.map((m) => (
            <option key={m} value={m}>
              {capitalize(m)}
            </option>
          ))}
        </select>
      </div>

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
