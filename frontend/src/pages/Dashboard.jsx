import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import useDocumentTitle from '../hooks/useDocumentTitle';
import client from '../api/client';
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

const svgProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  'aria-hidden': true,
  focusable: false,
};

const IconDashboard = () => (
  <svg {...svgProps}>
    <rect x="3" y="3" width="7" height="9" />
    <rect x="14" y="3" width="7" height="5" />
    <rect x="14" y="12" width="7" height="9" />
    <rect x="3" y="16" width="7" height="5" />
  </svg>
);
const IconGoals = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4" />
  </svg>
);
const IconLocations = () => (
  <svg {...svgProps}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const IconReport = () => (
  <svg {...svgProps}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
);
const IconSettings = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2V21a2 2 0 11-4 0v-.1A1.7 1.7 0 007 19.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.7 1.7 0 003 13.7H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 7l-.1-.1a2 2 0 112.8-2.8l.1.1A1.7 1.7 0 0010 3.1V3a2 2 0 114 0v.1a1.7 1.7 0 002.9 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 001.2 2.9H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
  </svg>
);

const RAIL_LINKS = [
  { to: '/dashboard', label: 'Dashboard', Icon: IconDashboard },
  { to: '/goals', label: 'Goals', Icon: IconGoals },
  { to: '/locations', label: 'Locations', Icon: IconLocations },
  { to: '/reports', label: 'Weekly report', Icon: IconReport },
];
const TAB_LINKS = RAIL_LINKS.slice(0, 3);

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

function Modal({ title, onClose, children }) {
  const titleId = useId();
  const dialogRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    dialogRef.current?.querySelector('input, select')?.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="dash-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="dash-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="dash-panel__head">
          <h2 id={titleId} className="dash-panel__title">{title}</h2>
          <div className="dash-panel__spacer" />
          <button type="button" className="dash-linkbtn" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function LogEntryForm({ goals, todayIso, onSaved, onCancel }) {
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
        logDate: todayIso,
      });
      onSaved();
    } catch {
      setError("Couldn't save that entry. Check your connection and try again.");
      setSaving(false);
    }
  };

  return (
    <form className="dash-form" onSubmit={submit}>
      <div className="dash-field">
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
      <div className="dash-field">
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
      <div className="dash-field">
        <label htmlFor="log-mood">Mood</label>
        <select id="log-mood" value={mood} onChange={(e) => setMood(e.target.value)}>
          {MOODS.map((m) => (
            <option key={m} value={m}>
              {capitalize(m)}
            </option>
          ))}
        </select>
      </div>
      <label className="dash-check">
        <input
          type="checkbox"
          checked={completed}
          onChange={(e) => setCompleted(e.target.checked)}
        />
        I did it today
      </label>
      {error && (
        <p className="dash-form__error" role="alert">
          {error}
        </p>
      )}
      <div className="dash-form__actions">
        <button type="button" className="dash-btn dash-btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="dash-btn" disabled={saving}>
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
    <form className="dash-form" onSubmit={submit}>
      <div className="dash-field">
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
      <div className="dash-field">
        <label htmlFor="goal-target">How often</label>
        <select id="goal-target" value={target} onChange={(e) => setTarget(Number(e.target.value))}>
          {TARGETS.map((n) => (
            <option key={n} value={n}>
              {n === 7 ? 'Every day' : `${n}× a week`}
            </option>
          ))}
        </select>
      </div>
      <div className="dash-field">
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
        <p className="dash-form__error" role="alert">
          {error}
        </p>
      )}
      <div className="dash-form__actions">
        <button type="button" className="dash-btn dash-btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="dash-btn" disabled={saving}>
          {saving ? 'Adding…' : 'Add goal'}
        </button>
      </div>
    </form>
  );
}

export default function Dashboard() {
  useDocumentTitle('Dashboard');

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [today] = useState(() => new Date());
  const todayIso = toIsoDate(today);
  const weekStart = useMemo(() => startOfWeek(today), [today]);
  const historyStartIso = toIsoDate(addDays(weekStart, -7 * HISTORY_WEEKS));

  const [goals, setGoals] = useState([]);
  const [behaviors, setBehaviors] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [modal, setModal] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const name = user?.name?.trim() || '';
  const todayColumn = summary.days.indexOf(todayIso);

  return (
    <div className="dash">
      <nav className="dash-rail" aria-label="Sections">
        <Link to="/dashboard" className="dash-rail__mark" aria-label="Mordi dashboard">
          M
        </Link>
        {RAIL_LINKS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className="dash-rail__link"
            aria-label={item.label}
            title={item.label}
          >
            <item.Icon />
          </NavLink>
        ))}
        <div className="dash-rail__spacer" />
        <NavLink to="/settings" className="dash-rail__link" aria-label="Settings" title="Settings">
          <IconSettings />
        </NavLink>
      </nav>

      <div>
        <header className="dash-topbar">
          <nav className="dash-tabs" aria-label="Primary">
            {TAB_LINKS.map((item) => (
              <NavLink key={item.to} to={item.to} className="dash-tab">
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="dash-topbar__spacer" />
          <div className="dash-whoami">
            <span className="dash-avatar" aria-hidden="true">
              {name ? name[0].toUpperCase() : '?'}
            </span>
            <span className="dash-whoami__name">{name}</span>
            <button type="button" className="dash-linkbtn" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>

        <main className="dash-main">
          {loadState === 'loading' && (
            <p className="dash-status" role="status">
              Loading your week…
            </p>
          )}

          {loadState === 'error' && (
            <div className="dash-status" role="alert">
              <span>Couldn&rsquo;t load your dashboard.</span>
              <button
                type="button"
                className="dash-btn dash-btn--ghost"
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
              <section className="dash-panel" aria-labelledby="dash-week-title">
                <div className="dash-panel__head">
                  <h1 id="dash-week-title" className="dash-panel__title">
                    This week
                  </h1>
                  <span className="dash-panel__meta">{formatWeekRange(weekStart)}</span>
                  <div className="dash-panel__spacer" />
                  <button type="button" className="dash-linkbtn" onClick={() => setModal('log')}>
                    Log today
                  </button>
                </div>

                {summary.rows.length === 0 ? (
                  <div className="dash-empty">
                    <p>No goals yet. Add one and each day of your week will fill in here.</p>
                    <button type="button" className="dash-btn" onClick={() => setModal('goal')}>
                      Add a goal
                    </button>
                  </div>
                ) : (
                  <div className="dash-week__scroll">
                    <div className="dash-week__days" aria-hidden="true">
                      <div />
                      {summary.days.map((iso, i) => (
                        <div
                          key={iso}
                          className={
                            'dash-week__day' + (i === todayColumn ? ' dash-week__day--today' : '')
                          }
                        >
                          {DAY_NAMES[i]}
                          <span>{parseIsoDate(iso).getDate()}</span>
                        </div>
                      ))}
                    </div>

                    {summary.rows.map((row) => (
                      <div className="dash-week__row" key={row.goal.id}>
                        <div className="dash-goal">
                          <div className="dash-goal__name">{row.goal.title}</div>
                          <div className="dash-goal__cat">
                            {row.goal.category
                              ? `${capitalize(row.goal.category)} · ${targetLabel(row.goal)}`
                              : capitalize(targetLabel(row.goal))}
                            <span className="dash-sr">
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
                            <span className="dash-sr">, {segmentDays(seg)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <div className="dash-cards">
                <section className="dash-panel" aria-labelledby="dash-recent-title">
                  <div className="dash-panel__head">
                    <h2 id="dash-recent-title" className="dash-panel__title">
                      Recent entries
                    </h2>
                  </div>
                  {recent.length === 0 ? (
                    <p className="dash-empty">Nothing logged yet. Your entries will show up here.</p>
                  ) : (
                    <ul className="dash-list">
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

                <section className="dash-panel" aria-labelledby="dash-progress-title">
                  <div className="dash-panel__head">
                    <h2 id="dash-progress-title" className="dash-panel__title">
                      Goal progress
                    </h2>
                    <div className="dash-panel__spacer" />
                    <button type="button" className="dash-linkbtn" onClick={() => setModal('goal')}>
                      Add goal
                    </button>
                  </div>
                  {summary.rows.length === 0 ? (
                    <p className="dash-empty">Goals you add will track here against their weekly target.</p>
                  ) : (
                    <ul className="dash-list">
                      {summary.rows.map((row) => (
                        <li className="dash-prog" key={row.goal.id}>
                          <div className="dash-prog__top">
                            <span>{row.goal.title}</span>
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

                <section className="dash-panel" aria-labelledby="dash-sofar-title">
                  <div className="dash-panel__head">
                    <h2 id="dash-sofar-title" className="dash-panel__title">
                      Week so far
                    </h2>
                    <div className="dash-panel__spacer" />
                    <span className="dash-panel__meta">Closes Sun</span>
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
                      className="dash-btn dash-btn--block"
                      onClick={() => setModal('log')}
                    >
                      Log today&rsquo;s entry
                    </button>
                  </div>
                </section>
              </div>
            </>
          )}
        </main>
      </div>

      {modal === 'log' && (
        <Modal title="Log today" onClose={closeModal}>
          <LogEntryForm
            goals={goals}
            todayIso={todayIso}
            onSaved={handleSaved}
            onCancel={closeModal}
          />
        </Modal>
      )}
      {modal === 'goal' && (
        <Modal title="Add a goal" onClose={closeModal}>
          <GoalForm onSaved={handleSaved} onCancel={closeModal} />
        </Modal>
      )}
    </div>
  );
}
