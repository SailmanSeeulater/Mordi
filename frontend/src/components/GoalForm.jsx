import { useState } from 'react';
import client from '../api/client';
import Select from './Select';
import { capturePlace } from '../lib/geo';
import { CATEGORY_OPTIONS } from '../lib/categories';

const TARGETS = [1, 2, 3, 4, 5, 6, 7];

/** Creates a goal, or edits `goal` when one is passed. */
export default function GoalForm({ goal, onSaved, onCancel }) {
  const editing = Boolean(goal);
  const [title, setTitle] = useState(goal?.title ?? '');
  const [category, setCategory] = useState(goal?.category ?? '');
  const [target, setTarget] = useState(goal?.targetPerWeek ?? 3);
  const [placeName, setPlaceName] = useState(goal?.placeName ?? '');
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const locate = async () => {
    setLocating(true);
    try {
      const place = await capturePlace();
      if (place.placeName) setPlaceName(place.placeName);
    } catch {
      setError('Location unavailable. Type the place instead.');
    }
    setLocating(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const body = {
      title: title.trim(),
      category,
      targetPerWeek: target,
      placeName: placeName.trim() || null,
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
        <span className="app-field__label" id="goal-target-label">
          Times a week
        </span>
        <div className="app-segments" role="group" aria-labelledby="goal-target-label">
          {/* The sliding fill. It is one element positioned by index rather
              than a background on each option, so changing the target moves
              it instead of repainting two of them. */}
          <span
            className="app-segments__thumb"
            style={{ '--n': TARGETS.length, '--i': TARGETS.indexOf(target) }}
            aria-hidden="true"
          />
          {TARGETS.map((n) => (
            <button
              key={n}
              type="button"
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
        <span className="app-field__label" id="goal-category-label">
          Category
        </span>
        <Select
          id="goal-category"
          labelledBy="goal-category-label"
          value={category}
          options={CATEGORY_OPTIONS}
          onChange={setCategory}
        />
      </div>

      <div className="app-field">
        <label htmlFor="goal-place">Usual place</label>
        <div className="app-inputrow">
          <input
            id="goal-place"
            value={placeName}
            onChange={(e) => setPlaceName(e.target.value)}
            placeholder="The gym on Fifth"
            maxLength={255}
          />
          <button
            type="button"
            className="app-btn app-btn--quiet app-btn--sm"
            onClick={locate}
            disabled={locating}
          >
            {locating ? 'Locating…' : 'Use my location'}
          </button>
        </div>
        <p className="app-field__hint">
          Optional. Entries you log against this goal start here.
        </p>
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
