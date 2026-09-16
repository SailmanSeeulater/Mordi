import { useState } from 'react';
import client from '../api/client';

const CATEGORIES = ['fitness', 'sleep', 'productivity', 'health'];
const TARGETS = [1, 2, 3, 4, 5, 6, 7];

const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');

/** Creates a goal, or edits `goal` when one is passed. */
export default function GoalForm({ goal, onSaved, onCancel }) {
  const editing = Boolean(goal);
  const [title, setTitle] = useState(goal?.title ?? '');
  const [category, setCategory] = useState(goal?.category ?? '');
  const [target, setTarget] = useState(goal?.targetPerWeek ?? 3);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const body = {
      title: title.trim(),
      category,
      targetPerWeek: target,
      // Keeps the frontend's target fallback accurate on older backends.
      frequency: target === 7 ? 'daily' : 'weekly',
    };
    try {
      if (editing) {
        await client.put(`/api/goals/${goal.id}`, body);
      } else {
        await client.post('/api/goals', body);
      }
      onSaved();
    } catch {
      setError(
        editing
          ? "Couldn't save your changes. Check your connection and try again."
          : "Couldn't create that goal. Check your connection and try again.",
      );
      setSaving(false);
    }
  };

  return (
    <form className="app-form" onSubmit={submit}>
      <div className="app-field">
        <label htmlFor="goal-title">Goal</label>
        <input
          id="goal-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Read before bed"
          required
          maxLength={255}
        />
      </div>

      <div className="app-field">
        <label id="goal-target-label" htmlFor="goal-target-3">
          Times a week
        </label>
        <div className="app-segments" role="group" aria-labelledby="goal-target-label">
          {TARGETS.map((n) => (
            <button
              key={n}
              type="button"
              id={`goal-target-${n}`}
              className="app-segment"
              aria-pressed={n === target}
              onClick={() => setTarget(n)}
            >
              {n === 7 ? 'Daily' : n}
              <span className="app-sr">{n === 7 ? '' : ` times a week`}</span>
            </button>
          ))}
        </div>
        <p className="app-field__hint">
          {target === 7
            ? 'A day with nothing logged counts as missed.'
            : `Any ${target} day${target > 1 ? 's' : ''} of the week counts.`}
        </p>
      </div>

      <div className="app-field">
        <label htmlFor="goal-category">Category</label>
        <select id="goal-category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">No category</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {capitalize(c)}
            </option>
          ))}
        </select>
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
          {saving ? 'Saving…' : editing ? 'Save goal' : 'Add goal'}
        </button>
      </div>
    </form>
  );
}
