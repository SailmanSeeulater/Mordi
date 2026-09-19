import { useCallback, useMemo, useState } from 'react';
import client from '../api/client';
import useDocumentTitle from '../hooks/useDocumentTitle';
import useToday from '../hooks/useToday';
import useWeekData from '../hooks/useWeekData';
import useSortOrder from '../hooks/useSortOrder';
import useDragSort from '../hooks/useDragSort';
import AppShell from '../components/AppShell';
import Modal from '../components/Modal';
import GoalForm from '../components/GoalForm';
import LogEntryForm from '../components/LogEntryForm';
import CalendarModal from '../components/CalendarModal';
import WeatherStrip from '../components/WeatherStrip';
import NotesPanel from '../components/NotesPanel';
import ClockChip from '../components/ClockChip';
import TimeLogger from '../components/TimeLogger';
import ActivityHeatmap from '../components/ActivityHeatmap';
import TodoList from '../components/TodoList';
import LatelyFeed from '../components/LatelyFeed';
import PlanToday from '../components/PlanToday';
import UndoToast from '../components/UndoToast';
import WeekReviewCard from '../components/WeekReviewCard';
import {
  addDays,
  currentStreak,
  formatWeekRange,
  parseIsoDate,
  recentEntries,
  toIsoDate,
  weekDays,
  weekSummary,
} from './dashboardData';
import './dashboard.css';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];





/**
 * One goal's ring. A tap logs it done today: logging is the one thing this
 * page is for, so it takes one action, with an Undo right after in case the
 * tap was a slip. Once today is logged the ring shows a tick, and a second
 * tap opens the full form instead, for adding a note or another entry.
 *
 * It is draggable where it sits. A press only becomes a drag after
 * useDragSort's threshold, so a tap is still a tap, and `touch-action: pan-y`
 * leaves the page free to scroll vertically under a finger.
 */
function GoalRing({ row, onClick, order, held, over, dragProps, onNudge, busy, loggedToday }) {
  const percent = Math.min(row.done / row.target, 1) * 100;
  const empty = row.done === 0;
  return (
    <button
      type="button"
      className={
        'ring-item' +
        (held ? ' ring-item--held' : '') +
        (over ? ' ring-item--over' : '') +
        (busy ? ' ring-item--busy' : '') +
        (loggedToday ? ' ring-item--today' : '')
      }
      onClick={onClick}
      data-sort-id={row.id}
      {...dragProps}
      style={{ order }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onNudge(row.id, -1);
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          onNudge(row.id, 1);
        }
      }}
    >
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
        {row.done} of {row.target} logged this week.{' '}
        {loggedToday
          ? 'Done today. Opens the form to add another entry.'
          : 'Logs it done today in one tap.'}{' '}
        Use the left and right arrow keys to move it.
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

const IconGrip = () => (
  <svg {...iconProps} width="14" height="14" strokeWidth="2.2">
    <path d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01" />
  </svg>
);

const IconRearrange = () => (
  <svg {...iconProps}>
    <path d="M4 7h9M4 12h13M4 17h7" />
    <path d="M17 5.5L20.5 9M20.5 9L17 12.5" />
  </svg>
);



/* One tap from an empty dashboard to a working one. */
const STARTERS = [
  { title: 'Morning run', category: 'fitness', target: 3 },
  { title: 'Read before bed', category: 'sleep', target: 7 },
  { title: 'Deep work block', category: 'productivity', target: 5 },
  { title: 'Stretch', category: 'health', target: 3 },
];

/* The left column's blocks, in their default order. Lately is not here: it
   lives in the other column and is the one thing that stays put. */
const SECTIONS = [
  { id: 'rings', label: 'Goal rings' },
  { id: 'week', label: 'This week' },
  { id: 'plan', label: "Today's plan" },
  { id: 'activity', label: 'Activity' },
  { id: 'notes', label: 'Notes' },
];

/**
 * One rearrangeable block.
 *
 * Position comes from the CSS `order` property, not from re-sorting the DOM:
 * moving a node restarts the CSS animations on it, which during a drag is a
 * flicker on every step. The grip only exists while Rearrange is on, so the
 * page carries no permanent chrome for a thing most people set once.
 */
function Block({ id, label, order, rearrange, drag, onNudge, children }) {
  const held = drag.dragId === id;
  const over = drag.overId === id;
  return (
    <div
      className={
        'mod' +
        (rearrange ? ' mod--movable' : '') +
        (held ? ' mod--held' : '') +
        (over ? ' mod--over' : '')
      }
      style={{ order }}
      data-sort-id={rearrange ? id : undefined}
    >
      {rearrange && (
        <button
          type="button"
          className="mod__grip"
          {...drag.handleProps(id)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              onNudge(id, -1);
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              onNudge(id, 1);
            }
          }}
          aria-label={`Move ${label}. Drag, or use the up and down arrow keys.`}
        >
          <IconGrip />
          {label}
        </button>
      )}
      {children}
    </div>
  );
}

export default function Dashboard() {
  useDocumentTitle('Today');

  const today = useToday();
  const { goals, behaviors, loadState, weekStart, todayIso, reload, retry } = useWeekData(today);

  const [modal, setModal] = useState(null);
  const [logGoalId, setLogGoalId] = useState('');


  const summary = useMemo(
    () => weekSummary(goals, behaviors, weekStart, today),
    [goals, behaviors, weekStart, today],
  );

  // The rings keep a saved order of their own, dragged into place.
  const rowsWithId = useMemo(
    () => summary.rows.map((row) => ({ ...row, id: String(row.goal.id) })),
    [summary.rows],
  );
  const goalOrder = useSortOrder('mordi-goal-order', rowsWithId);
  const goalDrag = useDragSort(goalOrder.moveOver);

  const [rearrange, setRearrange] = useState(false);
  const blockOrder = useSortOrder('mordi-dash-blocks', SECTIONS);
  const blockDrag = useDragSort(blockOrder.moveOver);
  const streak = useMemo(() => currentStreak(behaviors, today), [behaviors, today]);
  const recent = useMemo(() => recentEntries(behaviors, 40), [behaviors]);
  // Bumped after a save, so the year of activity picks up the new entry too.
  const [historyKey, setHistoryKey] = useState(0);

  const closeModal = useCallback(() => setModal(null), []);
  const handleSaved = useCallback(() => {
    setModal(null);
    reload();
    setHistoryKey((k) => k + 1);
  }, [reload]);

  const handleTimeSaved = useCallback(() => {
    reload();
    setHistoryKey((k) => k + 1);
  }, [reload]);

  const openLog = useCallback((goalId = '') => {
    setLogGoalId(goalId);
    setModal('log');
  }, []);

  // An Undo for whatever was just logged: a one-tap log, or a planned block
  // marked done.
  const [toast, setToast] = useState(null);
  const showToast = useCallback((t) => setToast({ ...t, key: Date.now() }), []);
  const clearToast = useCallback(() => setToast(null), []);

  const loggedToday = useMemo(
    () => new Set(behaviors.filter((b) => b.completed && b.logDate === todayIso && b.goal).map((b) => b.goal.id)),
    [behaviors, todayIso],
  );
  const [loggingId, setLoggingId] = useState(null);

  const tapRing = async (row) => {
    if (loggedToday.has(row.goal.id)) {
      openLog(row.goal.id);
      return;
    }
    setLoggingId(row.goal.id);
    try {
      const res = await client.post('/api/behaviors', {
        goalId: row.goal.id,
        note: row.goal.title,
        completed: true,
        mood: null,
        logDate: todayIso,
        placeName: row.goal.placeName ?? null,
      });
      handleTimeSaved();
      showToast({
        message: `Logged ${row.goal.title} for today`,
        undo: async () => {
          await client.delete(`/api/behaviors/${res.data.id}`);
          handleTimeSaved();
        },
      });
    } catch {
      showToast({ message: "Couldn't log that. Check your connection and try again.", undoable: false });
    } finally {
      setLoggingId(null);
    }
  };

  // Whether anything was logged last week, which decides whether there is a
  // week to write up and review.
  const lastWeekIso = toIsoDate(addDays(weekStart, -7));
  const thisWeekIso = toIsoDate(weekStart);
  const loggedLastWeek = behaviors.some((b) => b.logDate >= lastWeekIso && b.logDate < thisWeekIso);

  const [starting, setStarting] = useState('');
  const addStarter = async (starter) => {
    setStarting(starter.title);
    try {
      await client.post('/api/goals', {
        title: starter.title,
        category: starter.category,
        targetPerWeek: starter.target,
        frequency: starter.target === 7 ? 'daily' : 'weekly',
      });
      reload();
    } catch {
      showToast({ message: "Couldn't add that goal. Check your connection and try again.", undoable: false });
    } finally {
      setStarting('');
    }
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

  return (
    <AppShell
      title="Today"
      action={
        loadState === 'ready' && goals.length > 0 ? (
          <>
            <button
              type="button"
              className="app-iconbtn"
              onClick={() => setRearrange((on) => !on)}
              aria-pressed={rearrange}
              aria-label={rearrange ? 'Finish rearranging' : 'Rearrange this page'}
              title={rearrange ? 'Done rearranging' : 'Rearrange this page'}
            >
              <IconRearrange />
            </button>
            <button type="button" className="app-btn app-btn--sm" onClick={() => openLog()}>
              Log entry
            </button>
          </>
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
          <p className="onboard__body">Start from one of these, or write your own:</p>
          <ul className="onboard__starters">
            {STARTERS.map((st) => (
              <li key={st.title}>
                <button
                  type="button"
                  className="onboard__starter"
                  onClick={() => addStarter(st)}
                  disabled={starting !== ''}
                >
                  {starting === st.title ? 'Adding\u2026' : st.title}
                  <small>{st.target === 7 ? 'every day' : `${st.target}\u00d7 a week`}</small>
                </button>
              </li>
            ))}
          </ul>
          <div className="onboard__actions">
            <button type="button" className="app-btn" onClick={() => setModal('goal')}>
              Write your own goal
            </button>
            <button type="button" className="app-btn app-btn--ghost" onClick={() => openLog()}>
              Just log something
            </button>
          </div>
        </section>
      )}

      {loadState === 'ready' && goals.length > 0 && (
        <WeekReviewCard today={today} loggedLastWeek={loggedLastWeek} />
      )}

      {loadState === 'ready' && goals.length > 0 && (
        <div className="dash">
          <div className="dash__col">
            <Block
              id="rings"
              label="Goal rings"
              order={blockOrder.indexOf('rings')}
              rearrange={rearrange}
              drag={blockDrag}
              onNudge={blockOrder.nudge}
            >
              <div className="rings">
                {rowsWithId.map((row) => (
                  <GoalRing
                    key={row.id}
                    row={row}
                    onClick={() => tapRing(row)}
                    busy={loggingId === row.goal.id}
                    loggedToday={loggedToday.has(row.goal.id)}
                    order={goalOrder.indexOf(row.id)}
                    held={goalDrag.dragId === row.id}
                    over={goalDrag.overId === row.id}
                    dragProps={goalDrag.handleProps(row.id)}
                    onNudge={goalOrder.nudge}
                  />
                ))}
                {/* Always last, whatever the goals are doing. */}
                <button
                  type="button"
                  className="ring-item ring-item--add"
                  style={{ order: 999 }}
                  onClick={() => setModal('goal')}
                >
                  <span className="app-ring ring-item__ring" aria-hidden="true">
                    <span className="app-ring__inner ring-item__inner">+</span>
                  </span>
                  <span className="ring-item__label">Add goal</span>
                </button>
              </div>
            </Block>

            <Block
              id="week"
              label="This week"
              order={blockOrder.indexOf('week')}
              rearrange={rearrange}
              drag={blockDrag}
              onNudge={blockOrder.nudge}
            >
            <section className="pass" aria-labelledby="dash-pass-title">
              <h2 className="app-sr" id="dash-pass-title">
                This week, {formatWeekRange(weekStart)}
              </h2>
              {/* Same card, because it is the same question: what is this week
                  actually like. */}
              <div className="pass__crown">
                <ClockChip />
                <WeatherStrip />
              </div>
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
            </Block>

            <Block
              id="plan"
              label="Today's plan"
              order={blockOrder.indexOf('plan')}
              rearrange={rearrange}
              drag={blockDrag}
              onNudge={blockOrder.nudge}
            >
              <PlanToday today={today} goals={goals} onChanged={handleTimeSaved} onToast={showToast} />
            </Block>

            <Block
              id="activity"
              label="Activity"
              order={blockOrder.indexOf('activity')}
              rearrange={rearrange}
              drag={blockDrag}
              onNudge={blockOrder.nudge}
            >
              <ActivityHeatmap today={today} reloadKey={historyKey} onPickDay={openCalendar} />
            </Block>

            <Block
              id="notes"
              label="Notes"
              order={blockOrder.indexOf('notes')}
              rearrange={rearrange}
              drag={blockDrag}
              onNudge={blockOrder.nudge}
            >
              <section className="app-panel" aria-labelledby="dash-notes-title">
                <NotesPanel />
              </section>
            </Block>
          </div>

          <div className="dash__col">
            {/* To do, the timer and Lately share one card, read top to bottom
                as the day goes: what is left to do, what is being done now,
                and what is done. */}
            <div className="app-panel side">
              <TodoList />
              <TimeLogger onSaved={handleTimeSaved} />
              <LatelyFeed entries={recent} todayIso={todayIso} weekCount={summary.entries} />
            </div>
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
      <UndoToast
        key={toast?.key}
        toast={toast}
        onUndo={(t) => t.undo?.()}
        onDone={clearToast}
      />
    </AppShell>
  );
}
