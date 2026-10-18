import { useState } from 'react';
import client from '../api/client';
import Select from './Select';
import IconPicker from './IconPicker';
import CategoryEditor from './CategoryEditor';
import useCategories, { MAX_CATEGORIES } from '../hooks/useCategories';
import { capturePlace } from '../lib/geo';
import { CATEGORY_OPTIONS, ICONS, ICON_LABELS, goalCategory, goalIconKey } from '../lib/categories';
import { DAY_LETTERS, DAY_NAMES, daysToMask, isoDayOrder, plannedDays } from '../lib/plannedDays';
import { useWeekStart } from '../lib/weekStart';

const TARGETS = [1, 2, 3, 4, 5, 6, 7];

/** The category list's last option: not a category, the way to make one. */
const NEW_CATEGORY = '__new';

/** Creates a goal, or edits `goal` when one is passed. */
export default function GoalForm({ goal, onSaved, onCancel }) {
  const editing = Boolean(goal);
  const [title, setTitle] = useState(goal?.title ?? '');
  const [category, setCategory] = useState(goal?.category ?? '');
  const [icon, setIcon] = useState(goal?.icon ?? null);
  const [making, setMaking] = useState(false);
  const [choosingIcon, setChoosingIcon] = useState(false);
  const { categories, create: createCategory } = useCategories();
  const [chosenTarget, setTarget] = useState(goal?.targetPerWeek ?? 3);
  // Optional weekdays, ISO indexes (0 is Monday). Picked days set the target.
  const [days, setDays] = useState(() => plannedDays(goal));
  const dayOrder = isoDayOrder(useWeekStart());
  const target = days.length > 0 ? days.length : chosenTarget;
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
      // Empty goes back to the category's icon, as category does.
      icon: icon ?? '',
      targetPerWeek: target,
      // 0 clears them; the backend keeps the target equal to the days.
      plannedDays: daysToMask(days),
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
    } catch (err) {
      // A refused category or icon comes back with a line meant to be read.
      const refused = err?.response?.status === 400 && err.response.data?.error;
      setError(
        refused
          ? refused
          : editing
          ? 'Couldn’t save your changes. Check your connection and try again.'
          : 'Couldn’t create that goal. Check your connection and try again.',
      );
      setSaving(false);
    }
  };

  // Built-ins, then the person's own, then the way to add one.
  const categoryOptions = [
    ...CATEGORY_OPTIONS,
    ...categories.map((c) => ({ value: c.key, label: c.name, icon: ICONS[c.icon] ?? ICONS.thumbtack })),
  ];
  // A shared goal's category the list doesn't have still reads as itself.
  if (category && !categoryOptions.some((o) => o.value === category)) {
    const known = goalCategory(goal, categories);
    if (known) categoryOptions.push({ value: category, label: known.label, icon: ICONS[known.icon] });
  }
  if (categories.length < MAX_CATEGORIES) {
    categoryOptions.push({ value: NEW_CATEGORY, label: 'New category…' });
  }

  const draft = { ...goal, category, icon, categoryName: goal?.categoryName, categoryIcon: goal?.categoryIcon };
  const fallbackIcon = goalIconKey({ ...draft, icon: null }, categories);
  const shownIcon = goalIconKey(draft, categories);

  const pickCategory = (value) => {
    if (value === NEW_CATEGORY) {
      setMaking(true);
      return;
    }
    setMaking(false);
    setCategory(value);
  };

  const toggleDay = (d) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => a - b);
    // Clearing the last day leaves the segments on the count it had.
    if (next.length === 0) setTarget(days.length);
    setDays(next);
  };

  const makeCategory = async (body) => {
    const made = await createCategory(body);
    if (made?.key) setCategory(made.key);
    setMaking(false);
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
        <div
          className={'app-segments' + (days.length > 0 ? ' app-segments--locked' : '')}
          role="group"
          aria-labelledby="goal-target-label"
          aria-describedby="goal-target-hint"
        >
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
              disabled={days.length > 0}
              onClick={() => setTarget(n)}
            >
              {n === 7 ? 'Daily' : n}
              <span className="app-sr">{n === 7 ? '' : ` times a week`}</span>
            </button>
          ))}
        </div>
        <p className="app-field__hint" id="goal-target-hint">
          {days.length > 0
            ? 'Set by the days you picked. Clear the days to choose freely.'
            : target === 7
              ? 'A day with nothing logged counts as missed.'
              : `Any ${target} day${target > 1 ? 's' : ''} of the week counts.`}
        </p>
      </div>

      <div className="app-field">
        <span className="app-field__label" id="goal-days-label">
          On these days
        </span>
        <div className="app-daypick" role="group" aria-labelledby="goal-days-label" aria-describedby="goal-days-hint">
          {dayOrder.map((d) => (
            <button
              key={d}
              type="button"
              className="app-daypick__day"
              aria-pressed={days.includes(d)}
              aria-label={DAY_NAMES[d]}
              onClick={() => toggleDay(d)}
            >
              {DAY_LETTERS[d]}
            </button>
          ))}
        </div>
        <p className="app-field__hint" id="goal-days-hint">
          {days.length > 0
            ? 'They repeat every week. A picked day with nothing done counts as missed.'
            : 'Optional. Picked days repeat every week.'}
        </p>
      </div>

      <div className="app-field">
        <span className="app-field__label" id="goal-category-label">
          Category
        </span>
        <Select
          id="goal-category"
          labelledBy="goal-category-label"
          value={making ? NEW_CATEGORY : category}
          options={categoryOptions}
          onChange={pickCategory}
        />
        {making && (
          <CategoryEditor onSave={makeCategory} onCancel={() => setMaking(false)} />
        )}
      </div>

      <div className="app-field">
        <span className="app-field__label" id="goal-icon-label">
          Icon
        </span>
        <button
          type="button"
          className="app-btn app-btn--quiet app-btn--sm icon-field__toggle"
          aria-expanded={choosingIcon}
          aria-controls="goal-icon-panel"
          onClick={() => setChoosingIcon((open) => !open)}
        >
          <span className="icon-field__current" aria-hidden="true">
            {ICONS[shownIcon]}
          </span>
          {choosingIcon ? 'Done' : 'Choose an icon'}
          <span className="app-sr">
            {`, now ${icon ? ICON_LABELS[icon] : `the same as the category (${ICON_LABELS[fallbackIcon]})`}`}
          </span>
        </button>
        {choosingIcon && (
          <div className="icon-field__panel" id="goal-icon-panel">
            <IconPicker
              value={icon}
              onChange={setIcon}
              labelledBy="goal-icon-label"
              defaultLabel="Same as category"
              defaultIcon={fallbackIcon}
            />
          </div>
        )}
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
