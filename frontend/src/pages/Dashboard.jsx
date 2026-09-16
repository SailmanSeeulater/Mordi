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
import WeatherStrip from '../components/WeatherStrip';
import { CATEGORY_ICONS } from '../lib/categories';
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

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

const IconFanOut = () => (
  <svg {...iconProps}>
    <rect x="3" y="4" width="18" height="5" rx="1.5" />
    <rect x="3" y="12" width="18" height="5" rx="1.5" />
  </svg>
);

const IconRestack = () => (
  <svg {...iconProps}>
    <path d="M12 3l8 4.5-8 4.5-8-4.5L12 3z" />
    <path d="M4 13l8 4.5 8-4.5" />
  </svg>
);

const IconPin = () => (
  <svg {...iconProps} width="12" height="12" strokeWidth="2">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z" />
    <circle cx="12" cy="10" r="2.6" />
  </svg>
);

function GoalPass({ row, todayColumn, onLog }) {
  const left = row.target - row.done;
  const category = row.goal.category;
  return (
    <div className="goal-pass">
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
        {row.goal.placeName && (
          <span className="goal-pass__place">
            <IconPin />
            <span className="app-trunc">{row.goal.placeName}</span>
          </span>
        )}
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

/**
 * The goal deck.
 *
 * Every pass is rendered once, in one absolutely positioned layer, and opening
 * or closing the deck only changes how far down each pass is translated. The
 * container keeps its collapsed height at all times, so the page below never
 * moves: the deck opens over what follows it rather than pushing it down.
 * Because the movement is a transition on transform, closing is the same
 * motion played backwards, staggered from the top card instead of the bottom.
 */
// Collapsed, only three layers of the deck are drawn behind the front pass.
// A fourth adds nothing at 10px a card and makes the object taller for no
// information.
const PEEK = 10;
const MAX_PEEK = 3;

function GoalDeck({ rows, open, onToggle, todayColumn, onLog, restackKey }) {
  const layers = Math.min(Math.max(rows.length - 1, 0), MAX_PEEK);
  const collapsedHeight = `calc(var(--pass-h) + ${layers * PEEK}px)`;

  // Escape closes it, and so does a press anywhere outside it. Both listeners
  // are attached in an effect, which means they exist only from the render
  // after the one that opened the deck — the press that opened it can never
  // also close it. The toggle in the hint row counts as inside, or its own
  // handler and this one would cancel each other out.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onToggle();
    };
    const onDown = (e) => {
      if (!e.target.closest?.('.deck, .deck__hint')) onToggle();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, onToggle]);

  return (
    <div
      className={`deck${open ? ' deck--open' : ''}`}
      style={{ height: collapsedHeight }}
      key={restackKey}
    >
      {/* Purely visual: it dims what the open deck floats over. Dismissal is
          handled by the listeners above, so this takes no pointer events and
          is not in the tab order. */}
      {open && <div className="deck__scrim" aria-hidden="true" />}

      <div
        className="deck__layer"
        style={{ '--open-h': `calc(${rows.length} * (var(--pass-h) + var(--deck-gap)))` }}
      >
        {/* Gives the open layer something to scroll. The passes are absolutely
            positioned, so without it a deck taller than the screen would have
            its last cards off the bottom with no way to reach them. */}
        {open && <div className="deck__spacer" aria-hidden="true" />}
        {rows.map((row, i) => (
          <div
            key={row.goal.id}
            className="deck__card"
            style={{
              '--i': i,
              // Collapsed, the first pass is the one in front and the rest
              // peek out below it, each a little narrower — a deck seen
              // edge-on rather than a column of slivers. Open, they are a
              // list, so the order flips back.
              '--y': open
                ? `calc(${i} * (var(--pass-h) + var(--deck-gap)))`
                : `${Math.min(i, MAX_PEEK) * PEEK}px`,
              '--s': open ? 1 : 1 - Math.min(i, MAX_PEEK) * 0.03,
              zIndex: open ? i + 1 : rows.length - i,
            }}
          >
            <GoalPass
              row={row}
              todayColumn={todayColumn}
              onLog={open ? () => onLog(row.goal.id) : undefined}
            />
          </div>
        ))}
      </div>

      {/* Collapsed, the whole deck is one target. Open, each pass carries its
          own Log button and this is gone. */}
      {!open && (
        <button
          type="button"
          className="deck__grip"
          onClick={onToggle}
          aria-expanded={false}
          aria-label={`Fan out ${rows.length} goal ${rows.length === 1 ? 'pass' : 'passes'}`}
        />
      )}
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
  const toggleFan = useCallback(() => setFanned((isOpen) => !isOpen), []);

  // Changing the combination restacks the deck in the new colors. A keyed
  // remount rather than a class, so the entrance cannot replay on an
  // unrelated re-render.
  const [restackKey, setRestackKey] = useState(0);
  const firstTheme = useRef(true);
  useEffect(() => {
    if (firstTheme.current) {
      firstTheme.current = false;
      return;
    }
    setRestackKey((k) => k + 1);
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

  const openLog = useCallback((goalId = '') => {
    setLogGoalId(goalId);
    setModal('log');
  }, []);

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
        <section className="onboard app-glass" aria-labelledby="dash-onboard-title">
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

              {/* Same card, because it is the same question: what is this week
                  actually like. */}
              <div className="pass__weather">
                <WeatherStrip />
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
              <div className="deck__hint">
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

              <GoalDeck
                rows={summary.rows}
                open={fanned}
                onToggle={toggleFan}
                todayColumn={todayColumn}
                onLog={openLog}
                restackKey={restackKey}
              />
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
                      {(entry.goal || entry.placeName) && (
                        <div className="feed__foot">
                          {entry.goal && <span className="feed__goal">{entry.goal.title}</span>}
                          {entry.placeName && (
                            <span className="feed__place">
                              <IconPin />
                              {entry.placeName}
                            </span>
                          )}
                        </div>
                      )}
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
