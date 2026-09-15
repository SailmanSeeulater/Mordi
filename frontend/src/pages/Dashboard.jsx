import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import useToday from '../hooks/useToday';
import client from '../api/client';
import AppShell from '../components/AppShell';
import Modal from '../components/Modal';
import {
  addDays,
  currentStreak,
  formatWeekRange,
  parseIsoDate,
  recentEntries,
  startOfWeek,
  targetLabel,
  toIsoDate,
  weekSummary,
} from './dashboardData';
import './dashboard.css';

const HISTORY_WEEKS = 8;
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_BY_INDEX = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CATEGORIES = ['fitness', 'sleep', 'productivity', 'health'];
const MOODS = ['great', 'good', 'neutral', 'bad', 'terrible'];
const TARGETS = [1, 2, 3, 4, 5, 6, 7];

const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');

function segmentLabel({ status, length }) {
  const word = status === 'done' ? 'Logged' : 'Missed';
  return length > 1 ? `${word} — ${length} days` : word;
}

function segmentDays({ start, length }) {
  return length > 1
    ? `${DAY_NAMES[start]} to ${DAY_NAMES[start + length - 1]}`
    : DAY_NAMES[start];
}

function entryDateLabel(entry) {
  const date = parseIsoDate(entry.logDate);
  return `${WEEKDAY_BY_INDEX[date.getDay()]} ${date.getDate()}`;
}

function LogEntryForm({ goals, onSaved, onCancel }) {
  const [goalId, setGoalId] = useState('');
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
        // Read the clock at submit so a form opened before midnight still logs today.
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

function GoalForm({ onSaved, onCancel }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [target, setTarget] = useState(3);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await client.post('/api/goals', {
        title: title.trim(),
        category: category || null,
        targetPerWeek: target,
        // Keeps goalTarget()'s fallback accurate against a backend without targetPerWeek.
        frequency: target === 7 ? 'daily' : 'weekly',
      });
      onSaved();
    } catch {
      setError("Couldn't create that goal. Check your connection and try again.");
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
        <label htmlFor="goal-target">How often</label>
        <select id="goal-target" value={target} onChange={(e) => setTarget(Number(e.target.value))}>
          {TARGETS.map((n) => (
            <option key={n} value={n}>
              {n === 7 ? 'Every day' : `${n}× a week`}
            </option>
          ))}
        </select>
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
          {saving ? 'Adding…' : 'Add goal'}
        </button>
      </div>
    </form>
  );
}

export default function Dashboard() {
  useDocumentTitle('Dashboard');

  const today = useToday();
  const todayIso = toIsoDate(today);
  const weekStart = useMemo(() => startOfWeek(today), [today]);
  const historyStartIso = toIsoDate(addDays(weekStart, -7 * HISTORY_WEEKS));

  const [goals, setGoals] = useState([]);
  const [behaviors, setBehaviors] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [modal, setModal] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const weekScrollRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      client.get('/api/goals'),
      client.get('/api/behaviors/range', {
        params: { start: historyStartIso, end: todayIso },
      }),
    ])
      .then(([goalsRes, behaviorsRes]) => {
        if (cancelled) return;
        setGoals(goalsRes.data);
        setBehaviors(behaviorsRes.data);
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [historyStartIso, todayIso, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const closeModal = useCallback(() => setModal(null), []);
  const handleSaved = useCallback(() => {
    setModal(null);
    reload();
  }, [reload]);

  const summary = useMemo(
    () => weekSummary(goals, behaviors, weekStart, today),
    [goals, behaviors, weekStart, today],
  );
  const streak = useMemo(() => currentStreak(behaviors, today), [behaviors, today]);
  const recent = useMemo(() => recentEntries(behaviors, 4), [behaviors]);

  const todayColumn = summary.days.indexOf(todayIso);
  const goalCount = summary.rows.length;

  // When the week grid scrolls sideways (phones), bring today and the days before it into view.
  useEffect(() => {
    const scroller = weekScrollRef.current;
    if (!scroller || todayColumn < 0 || scroller.scrollWidth <= scroller.clientWidth) return;
    const cell = scroller.querySelector(`[data-day="${todayColumn}"]`);
    if (!cell) return;
    scroller.scrollLeft = Math.max(0, cell.offsetLeft + cell.offsetWidth - scroller.clientWidth);
  }, [loadState, todayColumn, goalCount]);

  return (
    <AppShell>
      {loadState === 'loading' && (
        <p className="app-status" role="status">
          Loading your week…
        </p>
      )}

      {loadState === 'error' && (
        <div className="app-status" role="alert">
          <span>Couldn&rsquo;t load your dashboard.</span>
          <button
            type="button"
            className="app-btn app-btn--ghost"
            onClick={() => {
              setLoadState('loading');
              reload();
            }}
          >
            Retry
          </button>
        </div>
      )}

      {loadState === 'ready' && (
        <>
          <section className="app-panel" aria-labelledby="dash-week-title">
            <div className="app-panel__head">
              <h1 id="dash-week-title" className="app-panel__title">
                This week
              </h1>
              <span className="app-panel__meta">{formatWeekRange(weekStart)}</span>
              <div className="app-panel__spacer" />
              <button type="button" className="app-linkbtn" onClick={() => setModal('log')}>
                Log today
              </button>
            </div>

            {goalCount === 0 ? (
              <div className="app-empty">
                <p>No goals yet. Add one and each day of your week will fill in here.</p>
                <button type="button" className="app-btn" onClick={() => setModal('goal')}>
                  Add a goal
                </button>
              </div>
            ) : (
              <div className="dash-week__scroll" ref={weekScrollRef}>
                <div className="dash-week__days" aria-hidden="true">
                  <div />
                  {summary.days.map((iso, i) => (
                    <div
                      key={iso}
                      data-day={i}
                      className={'dash-week__day' + (i === todayColumn ? ' dash-week__day--today' : '')}
                    >
                      {DAY_NAMES[i]}
                      <span>{parseIsoDate(iso).getDate()}</span>
                    </div>
                  ))}
                </div>

                {summary.rows.map((row) => (
                  <div className="dash-week__row" key={row.goal.id}>
                    <div className="dash-goal">
                      <div className="dash-goal__name" title={row.goal.title}>
                        {row.goal.title}
                      </div>
                      <div className="dash-goal__cat">
                        {row.goal.category
                          ? `${capitalize(row.goal.category)} · ${targetLabel(row.goal)}`
                          : capitalize(targetLabel(row.goal))}
                        <span className="app-sr">
                          , {row.done} of {row.target} this week
                        </span>
                      </div>
                    </div>
                    {summary.days.map((iso, i) => (
                      <div
                        key={iso}
                        className={'dash-slot' + (i === todayColumn ? ' dash-slot--today' : '')}
                        style={{ gridColumn: i + 2 }}
                      />
                    ))}
                    {row.segments.map((seg) => (
                      <div
                        key={seg.start}
                        className={`dash-seg dash-seg--${seg.status}`}
                        style={{ gridColumn: `${seg.start + 2} / span ${seg.length}` }}
                        title={`${segmentLabel(seg)} (${segmentDays(seg)})`}
                      >
                        {segmentLabel(seg)}
                        <span className="app-sr">, {segmentDays(seg)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="dash-cards">
            <section className="app-panel" aria-labelledby="dash-recent-title">
              <div className="app-panel__head">
                <h2 id="dash-recent-title" className="app-panel__title">
                  Recent entries
                </h2>
              </div>
              {recent.length === 0 ? (
                <p className="app-empty">Nothing logged yet. Your entries will show up here.</p>
              ) : (
                <ul className="app-list">
                  {recent.map((entry) => (
                    <li className="dash-entry" key={entry.id}>
                      <div className="dash-entry__top">
                        <span className="dash-entry__date">{entryDateLabel(entry)}</span>
                        <span className="dash-entry__spacer" />
                        {entry.mood && (
                          <span className="dash-entry__mood">{capitalize(entry.mood)}</span>
                        )}
                      </div>
                      <p className="dash-entry__note">{entry.note}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="app-panel" aria-labelledby="dash-progress-title">
              <div className="app-panel__head">
                <h2 id="dash-progress-title" className="app-panel__title">
                  Goal progress
                </h2>
                <div className="app-panel__spacer" />
                <button type="button" className="app-linkbtn" onClick={() => setModal('goal')}>
                  Add goal
                </button>
              </div>
              {goalCount === 0 ? (
                <p className="app-empty">Goals you add will track here against their weekly target.</p>
              ) : (
                <ul className="app-list">
                  {summary.rows.map((row) => (
                    <li className="dash-prog" key={row.goal.id}>
                      <div className="dash-prog__top">
                        <span className="dash-prog__name">{row.goal.title}</span>
                        <span className="dash-prog__count">
                          {row.done} / {row.target}
                        </span>
                      </div>
                      <div
                        className="dash-prog__bar"
                        role="progressbar"
                        aria-label={`${row.goal.title} this week`}
                        aria-valuemin={0}
                        aria-valuemax={row.target}
                        aria-valuenow={Math.min(row.done, row.target)}
                      >
                        <div
                          className="dash-prog__fill"
                          style={{ width: `${Math.min(row.done / row.target, 1) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="app-panel" aria-labelledby="dash-sofar-title">
              <div className="app-panel__head">
                <h2 id="dash-sofar-title" className="app-panel__title">
                  Week so far
                </h2>
                <div className="app-panel__spacer" />
                <span className="app-panel__meta">Closes Sun</span>
              </div>
              <div className="dash-report">
                <p className="dash-bignum">
                  {summary.percent}
                  <small>%</small>
                </p>
                <p className="dash-report__label">of planned entries logged</p>
                <dl className="dash-report__grid">
                  <div className="dash-stat">
                    <dt className="dash-stat__k">Streak</dt>
                    <dd className="dash-stat__v">
                      {streak} {streak === 1 ? 'day' : 'days'}
                    </dd>
                  </div>
                  <div className="dash-stat">
                    <dt className="dash-stat__k">Entries</dt>
                    <dd className="dash-stat__v">{summary.entries}</dd>
                  </div>
                  <div className="dash-stat">
                    <dt className="dash-stat__k">Top mood</dt>
                    <dd className="dash-stat__v">
                      {summary.topMood ? capitalize(summary.topMood) : '—'}
                    </dd>
                  </div>
                  <div className="dash-stat">
                    <dt className="dash-stat__k">Missed</dt>
                    <dd className="dash-stat__v">{summary.missed}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className="app-btn app-btn--block dash-report__cta"
                  onClick={() => setModal('log')}
                >
                  Log today&rsquo;s entry
                </button>
              </div>
            </section>
          </div>
        </>
      )}

      {modal === 'log' && (
        <Modal title="Log today" onClose={closeModal}>
          <LogEntryForm goals={goals} onSaved={handleSaved} onCancel={closeModal} />
        </Modal>
      )}
      {modal === 'goal' && (
        <Modal title="Add a goal" onClose={closeModal}>
          <GoalForm onSaved={handleSaved} onCancel={closeModal} />
        </Modal>
      )}
    </AppShell>
  );
}
