import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useTheme } from '../context/useTheme';
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

/**
 * One goal's ring.
 *
 * It is draggable where it sits rather than behind a mode, because that is
 * what a row of movable tiles implies. A press only becomes a drag after
 * useDragSort's threshold, so tapping still opens the log form, and
 * `touch-action: pan-y` leaves the page free to scroll vertically under a
 * finger while horizontal movement comes to us.
 */
function GoalRing({ row, onClick, order, held, over, dragProps, onNudge }) {
  const percent = Math.min(row.done / row.target, 1) * 100;
  const empty = row.done === 0;
  return (
    <button
      type="button"
      className={
        'ring-item' +
        (held ? ' ring-item--held' : '') +
        (over ? ' ring-item--over' : '')
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
        {row.done} of {row.target} logged this week. Log an entry for this goal. Use the left
        and right arrow keys to move it.
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

const IconPin = () => (
  <svg {...iconProps} width="12" height="12" strokeWidth="2">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z" />
    <circle cx="12" cy="10" r="2.6" />
  </svg>
);

function GoalPass({ row, todayColumn, onLog, grip }) {
  const left = row.target - row.done;
  const category = row.goal.category;
  return (
    <div className="goal-pass">
      {grip}
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

/** Breathing room between the open panel and the edges of the screen. */
const PANEL_MARGIN = 14;

function GoalDeck({ rows, open, onToggle, todayColumn, onLog, restackKey, drag, onNudge }) {
  const layers = Math.min(Math.max(rows.length - 1, 0), MAX_PEEK);
  const collapsedHeight = `calc(var(--pass-h) + ${layers * PEEK}px)`;

  const deckRef = useRef(null);
  const [panel, setPanel] = useState(null);

  /* Where the open panel goes.
   *
   * It prefers to grow upward from the collapsed deck, so it never pushes
   * past the bottom of the screen. But growing upward without a limit walks
   * off the top instead, which is worse: the passes are then unreachable,
   * because the panel is fixed and the page cannot scroll to it. So the
   * height is capped to the viewport and the top edge is clamped, and if the
   * deck still does not fit it scrolls inside itself.
   *
   * Fixed positioning, measured in viewport coordinates, with page scroll
   * locked while it is open — the same treatment a dialog gets. Anything
   * anchored to the page would drift out of view the moment you scrolled.
   */
  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const el = deckRef.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      // The pass height and gap stay declared in CSS, including the phone
      // override, so they are read back rather than duplicated here.
      const style = getComputedStyle(el);
      const passH = parseFloat(style.getPropertyValue('--pass-h')) || 104;
      const gap = parseFloat(style.getPropertyValue('--deck-gap')) || 10;
      const full = rows.length * (passH + gap);

      const height = Math.min(full, window.innerHeight - PANEL_MARGIN * 2);
      const top = Math.min(
        Math.max(box.bottom - height, PANEL_MARGIN),
        window.innerHeight - height - PANEL_MARGIN,
      );
      setPanel({
        top,
        left: box.left,
        width: box.width,
        height,
        full,
        clipped: full > height + 1,
      });
    };
    // A layout effect, measured and applied before the browser paints, so the
    // panel never shows for a frame at the wrong size or in last time's
    // position.
    place();
    // The panel is fixed, so it has to be re-placed as the page moves under
    // it, which keeps it anchored to the deck and inside the viewport. An
    // earlier version locked body scroll instead; because the body is the
    // scrolling element here, `overflow: hidden` clamped it to the top and
    // opening the deck jumped the whole page.
    window.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place);
      window.removeEventListener('resize', place);
    };
  }, [open, rows.length]);

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
    // A frame later, not immediately. Attaching it in the same tick as the
    // render that opened the deck let the opening interaction's own trailing
    // events reach it, so the deck opened and shut again on one press.
    const armed = requestAnimationFrame(() =>
      document.addEventListener('pointerdown', onDown),
    );
    return () => {
      cancelAnimationFrame(armed);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, onToggle]);

  return (
    <div
      className={`deck${open ? ' deck--open' : ''}`}
      ref={deckRef}
      style={{ height: collapsedHeight }}
      key={restackKey}
    >
      {/* Purely visual: it dims what the open deck floats over. Dismissal is
          handled by the listeners above, so this takes no pointer events and
          is not in the tab order. */}
      {open && <div className="deck__scrim" aria-hidden="true" />}

      <div
        className={`deck__layer${open && panel?.clipped ? ' deck__layer--clipped' : ''}`}
        style={
          open && panel
            ? {
                position: 'fixed',
                top: panel.top,
                left: panel.left,
                width: panel.width,
                height: panel.height,
                '--open-h': `${panel.full}px`,
              }
            : undefined
        }
      >
        {/* Gives the open layer something to scroll. The passes are absolutely
            positioned, so without it a deck taller than the screen would have
            its last cards off the bottom with no way to reach them. */}
        {open && <div className="deck__spacer" aria-hidden="true" />}
        {rows.map((row, i) => (
          <div
            key={row.goal.id}
            className={
              'deck__card' +
              (drag.dragId === String(row.id) ? ' deck__card--held' : '') +
              (drag.overId === String(row.id) ? ' deck__card--over' : '')
            }
            data-sort-id={row.id}
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
              grip={
                open ? (
                  <button
                    type="button"
                    className="goal-pass__grip"
                    {...drag.handleProps(row.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        onNudge(row.id, -1);
                      }
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        onNudge(row.id, 1);
                      }
                    }}
                    aria-label={`Move ${row.goal.title}. Drag, or use the up and down arrow keys.`}
                    title="Drag to reorder"
                  >
                    <IconGrip />
                  </button>
                ) : null
              }
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

/* The left column's blocks, in their default order. Lately is not here: it
   lives in the other column and is the one thing that stays put. */
const SECTIONS = [
  { id: 'rings', label: 'Goal rings' },
  { id: 'week', label: 'This week' },
  { id: 'deck', label: 'Goal passes' },
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

  // One saved order drives both the ring rail and the deck, because they are
  // two views of the same list: dragging a ring moves its pass too.
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
                    onClick={() => openLog(row.goal.id)}
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
              id="deck"
              label="Goal passes"
              order={blockOrder.indexOf('deck')}
              rearrange={rearrange}
              drag={blockDrag}
              onNudge={blockOrder.nudge}
            >
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
                rows={goalOrder.ordered}
                open={fanned}
                onToggle={toggleFan}
                todayColumn={todayColumn}
                onLog={openLog}
                restackKey={restackKey}
                drag={goalDrag}
                onNudge={goalOrder.nudge}
              />
            </section>
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
