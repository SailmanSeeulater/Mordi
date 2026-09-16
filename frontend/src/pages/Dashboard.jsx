import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useTheme } from '../context/useTheme';
import useToday from '../hooks/useToday';
import useWeekData from '../hooks/useWeekData';
import AppShell from '../components/AppShell';
import Modal from '../components/Modal';
import GoalForm from '../components/GoalForm';
import LogEntryForm from '../components/LogEntryForm';
import CalendarModal from '../components/CalendarModal';
import {
  currentStreak,
  formatWeekRange,
  parseIsoDate,
  recentEntries,
  targetLabel,
  toIsoDate,
  weekDays,
  weekSummary,
} from './dashboardData';
import './dashboard.css';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEKDAY_BY_INDEX = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MOOD_TONE = {
  great: 'up',
  good: 'up',
  neutral: 'flat',
  bad: 'down',
  terrible: 'down',
};

const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function entryDateLabel(entry) {
  const date = parseIsoDate(entry.logDate);
  return `${WEEKDAY_BY_INDEX[date.getDay()]} ${date.getDate()}`;
}

function GoalRing({ row, onClick }) {
  const percent = Math.min(row.done / row.target, 1) * 100;
  const empty = row.done === 0;
  return (
    <button type="button" className="ring-item" onClick={onClick}>
      <span
        className={`app-ring ring-item__ring${empty ? ' app-ring--empty' : ''}`}
        style={{ '--ring-p': percent }}
        aria-hidden="true"
      >
        <span className="app-ring__inner ring-item__inner">
          {row.done}/{row.target}
        </span>
      </span>
      <span className="ring-item__label">{row.goal.title}</span>
      <span className="app-sr">
        {row.done} of {row.target} logged this week. Log an entry for this goal.
      </span>
    </button>
  );
}

// Four tint steps, so neighbouring passes in the deck never share a field.
const TINTS = ['7%', '12%', '17%', '22%'];

const catIcon = {
  width: 14,
  height: 14,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

const CATEGORY_ICONS = {
  fitness: (
    <svg {...catIcon}>
      <path d="M6 7v10M18 7v10M3 12h18" />
    </svg>
  ),
  sleep: (
    <svg {...catIcon}>
      <path d="M20 14.5A8 8 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
    </svg>
  ),
  productivity: (
    <svg {...catIcon}>
      <path d="M12 3v3.5M12 21v-3.5M3 12h3.5M21 12h-3.5" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  ),
  health: (
    <svg {...catIcon}>
      <path d="M12 20s-7-4.4-7-9a4 4 0 017-2.6A4 4 0 0119 11c0 4.6-7 9-7 9z" />
    </svg>
  ),
};

const IconFanOut = () => (
  <svg {...catIcon} width="18" height="18">
    <rect x="3" y="4" width="18" height="5" rx="2" />
    <rect x="3" y="12" width="18" height="5" rx="2" />
  </svg>
);

const IconRestack = () => (
  <svg {...catIcon} width="18" height="18">
    <path d="M12 3l8 4.5-8 4.5-8-4.5L12 3z" />
    <path d="M4 13l8 4.5 8-4.5" />
  </svg>
);


function GoalPass({ row, index, todayColumn, onLog }) {
  const left = row.target - row.done;
  const category = row.goal.category;
  return (
    <div className="goal-pass" style={{ '--tint': TINTS[index % TINTS.length] }}>
      <div className="goal-pass__title">
        <span className="goal-pass__mark" aria-hidden="true">
          {row.goal.title.trim()[0]?.toUpperCase() ?? 'M'}
        </span>
        <span className="goal-pass__name">{row.goal.title}</span>
      </div>

      <div className="goal-pass__meta">
        {category && (
          <span className="goal-pass__cat">
            {CATEGORY_ICONS[category] ?? null}
            {capitalize(category)}
          </span>
        )}
        <span>{targetLabel(row.goal)}</span>
        <span className="goal-pass__count">{left > 0 ? `${left} to go` : 'Target met'}</span>
        <span className="app-sr">
          , {row.done} of {row.target} this week
        </span>
      </div>

      {onLog && (
        <div className="goal-pass__action">
          <button type="button" className="app-btn app-btn--quiet app-btn--sm" onClick={onLog}>
            Log
          </button>
        </div>
      )}

      <div className="goal-pass__week" aria-hidden="true">
        {row.statuses.map((status, i) => (
          <span
            key={i}
            className={
              'week-dot' +
              (status === 'done' ? ' week-dot--done' : '') +
              (status === 'missed' ? ' week-dot--missed' : '') +
              (i === todayColumn ? ' week-dot--today' : '')
            }
          />
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  useDocumentTitle('Today');

  const today = useToday();
  const { goals, behaviors, loadState, weekStart, todayIso, reload, retry } = useWeekData(today);

  const { theme } = useTheme();
  const [modal, setModal] = useState(null);
  const [logGoalId, setLogGoalId] = useState('');
  const [fanned, setFanned] = useState(prefersReducedMotion);
  // True only while the deck is springing open, so the fan animation never
  // replays on an unrelated re-render.
  // 'fanning' while it springs open, 'gathering' while it stacks back; cleared
  // after the run so neither replays on an unrelated re-render.
  const [deckMotion, setDeckMotion] = useState(null);
  const toggleFan = () => {
    setFanned((open) => {
      setDeckMotion(open ? 'gathering' : 'fanning');
      setTimeout(() => setDeckMotion(null), 700);
      return !open;
    });
  };

  // Changing the combination restacks the deck in the new colors — the second
  // half of the signature interaction. The reduced-motion rule flattens it.
  const [restackKey, setRestackKey] = useState(0);
  const [restacking, setRestacking] = useState(false);
  const firstTheme = useRef(true);
  useEffect(() => {
    if (firstTheme.current) {
      firstTheme.current = false;
      return;
    }
    setRestackKey((k) => k + 1);
    setRestacking(true);
    // Cleared after the run, so the deck doesn't replay its entrance on an
    // unrelated re-render such as the fan toggle.
    const done = setTimeout(() => setRestacking(false), 600);
    return () => clearTimeout(done);
  }, [theme]);

  const summary = useMemo(
    () => weekSummary(goals, behaviors, weekStart, today),
    [goals, behaviors, weekStart, today],
  );
  const streak = useMemo(() => currentStreak(behaviors, today), [behaviors, today]);
  const recent = useMemo(() => recentEntries(behaviors, 6), [behaviors]);

  const closeModal = useCallback(() => setModal(null), []);
  const handleSaved = useCallback(() => {
    setModal(null);
    reload();
  }, [reload]);

  const openLog = (goalId = '') => {
    setLogGoalId(goalId);
    setModal('log');
  };

  const [calendarDay, setCalendarDay] = useState(null);
  const openCalendar = (iso) => {
    setCalendarDay(iso);
    setModal('calendar');
  };

  const todayColumn = summary.days.indexOf(todayIso);
  const planned = summary.rows.reduce((sum, r) => sum + r.target, 0);
  const achieved = summary.rows.reduce((sum, r) => sum + Math.min(r.done, r.target), 0);

  // The pass's day strip reads the user's own logging, across every goal.
  const dayStates = useMemo(() => {
    const doneDays = new Set(behaviors.filter((b) => b.completed).map((b) => b.logDate));
    const loggedDays = new Set(behaviors.map((b) => b.logDate));
    return weekDays(weekStart).map((date) => {
      const iso = toIsoDate(date);
      if (doneDays.has(iso)) return 'done';
      if (iso > todayIso) return 'ahead';
      if (loggedDays.has(iso) || iso === todayIso) return 'open';
      return 'missed';
    });
  }, [behaviors, weekStart, todayIso]);

  // A long list of goals would make the collapsed deck taller than the screen,
  // so the passes overlap more tightly the more there are.
  const stackStep = summary.rows.length > 6 ? 14 : 26;
  const stackHeight = fanned
    ? `calc(${summary.rows.length} * (var(--pass-h) + var(--stack-gap)) - var(--stack-gap))`
    : `calc(var(--pass-h) + ${Math.max(summary.rows.length - 1, 0) * stackStep}px)`;

  return (
    <AppShell
      title="Today"
      action={
        loadState === 'ready' && goals.length > 0 ? (
          <button type="button" className="app-btn app-btn--sm" onClick={() => openLog()}>
            Log entry
          </button>
        ) : null
      }
    >
      {loadState === 'loading' && (
        <p className="app-status" role="status">
          Loading your week…
        </p>
      )}

      {loadState === 'error' && (
        <div className="app-status" role="alert">
          <span>Couldn&rsquo;t load your week.</span>
          <button type="button" className="app-btn app-btn--quiet" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {loadState === 'ready' && goals.length === 0 && (
        <section className="onboard" aria-labelledby="dash-onboard-title">
          <h2 className="onboard__title" id="dash-onboard-title">
            Start with one goal.
          </h2>
          <p className="onboard__body">
            Mordi counts what you do against a target you set — two runs a week, or reading every
            night. Nothing here is a streak you have to protect.
          </p>
          <ol className="onboard__steps">
            <li>Add a goal and say how many days a week it should happen.</li>
            <li>Log an entry when you do it. One line is enough.</li>
            <li>Come back to see the week fill in.</li>
          </ol>
          <div className="onboard__actions">
            <button type="button" className="app-btn" onClick={() => setModal('goal')}>
              Add your first goal
            </button>
            <button type="button" className="app-btn app-btn--ghost" onClick={() => openLog()}>
              Just log something
            </button>
          </div>
        </section>
      )}

      {loadState === 'ready' && goals.length > 0 && (
        <div className="dash">
          <div className="dash__col">
            <div className="rings">
              {summary.rows.map((row) => (
                <GoalRing key={row.goal.id} row={row} onClick={() => openLog(row.goal.id)} />
              ))}
              <button
                type="button"
                className="ring-item ring-item--add"
                onClick={() => setModal('goal')}
              >
                <span className="app-ring ring-item__ring" aria-hidden="true">
                  <span className="app-ring__inner ring-item__inner">+</span>
                </span>
                <span className="ring-item__label">Add goal</span>
              </button>
            </div>

            <section className="pass" aria-labelledby="dash-pass-title">
              <h2 className="app-sr" id="dash-pass-title">
                This week, {formatWeekRange(weekStart)}
              </h2>
              <div className="pass__body">
                <div className="pass__headline">
                  <p className="pass__figure">
                    {summary.percent}
                    <small>%</small>
                  </p>
                  <p className="pass__sub">
                    <span className="pass__range">{formatWeekRange(weekStart)}</span> — {achieved}{' '}
                    of {planned} planned {planned === 1 ? 'entry' : 'entries'} logged across{' '}
                    {summary.rows.length} {summary.rows.length === 1 ? 'goal' : 'goals'}.
                  </p>
                </div>
                <dl className="pass__fields">
                  <div className="pass__field">
                    <dt>Streak</dt>
                    <dd>
                      {streak} {streak === 1 ? 'day' : 'days'}
                    </dd>
                  </div>
                  <div className="pass__field">
                    <dt>Entries</dt>
                    <dd>{summary.entries}</dd>
                  </div>
                </dl>
              </div>

              {/* Each day is its own button, so its state stays in the
                  accessible name instead of being swallowed by a wrapper. */}
              <div className="pass__days">
                {dayStates.map((state, i) => (
                  <button
                    key={i}
                    type="button"
                    className={
                      'day-chip' +
                      (state === 'done' ? ' day-chip--done' : '') +
                      (state === 'missed' ? ' day-chip--missed' : '') +
                      (i === todayColumn ? ' day-chip--today' : '')
                    }
                    onClick={() => openCalendar(summary.days[i])}
                    aria-label={
                      `${DAY_NAMES[i]} ${parseIsoDate(summary.days[i]).getDate()}` +
                      (state === 'done'
                        ? ', logged'
                        : state === 'missed'
                          ? ', nothing logged'
                          : state === 'ahead'
                            ? ', still to come'
                            : ', nothing logged yet') +
                      (i === todayColumn ? ', today' : '') +
                      '. Open the month calendar.'
                    }
                  >
                    <span aria-hidden="true">{DAY_LETTERS[i]}</span>
                    <span className="day-chip__num" aria-hidden="true">
                      {parseIsoDate(summary.days[i]).getDate()}
                    </span>
                    {i === todayColumn ? (
                      <span className="day-chip__now" aria-hidden="true">
                        NOW
                      </span>
                    ) : (
                      <span className="day-chip__dot" aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>

              <div className="pass__action">
                <button type="button" className="pass__cta" onClick={() => openLog()}>
                  Log today
                </button>
                <button
                  type="button"
                  className="pass__cta pass__cta--quiet"
                  onClick={() => setModal('goal')}
                >
                  Add goal
                </button>
              </div>
            </section>

            <section aria-labelledby="dash-stack-title">
              <h2 className="app-sr" id="dash-stack-title">
                Goal passes
              </h2>
              <div className="stack__hint">
                <span>
                  {summary.rows.length} {summary.rows.length === 1 ? 'pass' : 'passes'}
                </span>
                <span className="app-panel__spacer" />
                <button
                  type="button"
                  className="app-iconbtn"
                  onClick={toggleFan}
                  aria-pressed={fanned}
                  aria-label={fanned ? 'Stack the passes' : 'Fan out the passes'}
                  title={fanned ? 'Stack the passes' : 'Fan out the passes'}
                >
                  {fanned ? <IconRestack /> : <IconFanOut />}
                </button>
              </div>

              <div
                className={
                  'stack' +
                  (restacking ? ' stack--restack' : '') +
                  (deckMotion ? ` stack--${deckMotion}` : '')
                }
                key={`${restackKey}-${fanned}`}
                style={{ height: stackHeight }}
              >
                {fanned ? (
                  summary.rows.map((row, i) => (
                    <div
                      key={row.goal.id}
                      className="stack__card"
                      style={{
                        '--y': `calc(${i} * (var(--pass-h) + var(--stack-gap)))`,
                        '--i': i,
                        zIndex: i + 1,
                      }}
                    >
                      <GoalPass
                        row={row}
                        index={i}
                        todayColumn={todayColumn}
                        onLog={() => openLog(row.goal.id)}
                      />
                    </div>
                  ))
                ) : (
                  <button
                    type="button"
                    className="stack__deck"
                    onClick={toggleFan}
                    aria-label={`Fan out ${summary.rows.length} goal passes`}
                  >
                    {summary.rows.map((row, i) => (
                      <div
                        key={row.goal.id}
                        className="stack__card"
                        style={{ '--y': `${i * stackStep}px`, '--i': i, zIndex: i + 1 }}
                      >
                        <GoalPass row={row} index={i} todayColumn={todayColumn} />
                      </div>
                    ))}
                  </button>
                )}
              </div>
            </section>
          </div>

          <div className="dash__col">
            <section className="app-panel" aria-labelledby="dash-feed-title">
              <div className="app-panel__head">
                <h2 className="app-panel__title" id="dash-feed-title">
                  Lately
                </h2>
                <div className="app-panel__spacer" />
                <span className="app-panel__meta">{summary.entries} this week</span>
              </div>
              {recent.length === 0 ? (
                <p className="app-empty">Nothing logged yet. Your entries show up here.</p>
              ) : (
                <ul className="app-list feed">
                  {recent.map((entry) => (
                    <li className="feed__item" key={entry.id}>
                      <div className="feed__top">
                        <span className="feed__date">{entryDateLabel(entry)}</span>
                        <span className="feed__spacer" />
                        {entry.mood && (
                          <span className={`mood mood--${MOOD_TONE[entry.mood] ?? 'flat'}`}>
                            {capitalize(entry.mood)}
                          </span>
                        )}
                      </div>
                      <p className="feed__note">{entry.note}</p>
                      {entry.goal && <span className="feed__goal">{entry.goal.title}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      {modal === 'log' && (
        <Modal title="Log an entry" onClose={closeModal}>
          <LogEntryForm
            goals={goals}
            initialGoalId={logGoalId}
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
      {modal === 'calendar' && (
        <CalendarModal
          behaviors={behaviors}
          today={today}
          initialSelected={calendarDay}
          onClose={closeModal}
          onLogDay={() => openLog()}
        />
      )}
    </AppShell>
  );
}
