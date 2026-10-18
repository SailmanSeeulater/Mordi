import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import useLogHistory from '../hooks/useLogHistory';
import { LEVELS, buildHeatmap, buildMonth, countByDay, describeDay, describeMonth } from '../lib/activity';
import { storedChoice } from '../lib/storedChoice';
import { useWeekStart, weekdayLabels } from '../lib/weekStart';
import { addDays, addMonths, parseIsoDate, startOfMonth, startOfWeek, toIsoDate } from '../pages/dashboardData';
import './activity.css';

const WEEKS = 53;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Year or month, remembered per browser like the other display choices. */
const VIEWS = [
  { id: 'year', label: 'Year' },
  { id: 'month', label: 'Month' },
];
const activityView = storedChoice({ key: 'mordi-activity-view', values: ['year', 'month'], fallback: 'year' });

/**
 * A year of logging, one square per day, darker the more was logged that day —
 * the contribution graph from a code host, applied to a person's week.
 *
 * Columns are Monday-to-Sunday weeks, to match every other week in the app.
 * The shade is set by lib/activity: one to four logs map straight to four
 * steps, and only a heavier day stretches the scale.
 *
 * Clicking a day opens the month calendar on it. The squares are not
 * individually focusable — a year is 371 tab stops — so the grid is described
 * as a whole, and keyboard users reach any day through the week card and the
 * calendar instead.
 *
 * The month view is the same data at a size one month can afford: a calendar
 * of squares with the day number in each, one tab stop, and arrow keys
 * between the days.
 */
export default function ActivityHeatmap({ today, reloadKey, onPickDay }) {
  const { entries, loadState, retry } = useLogHistory(today, WEEKS, reloadKey);
  const counts = useMemo(() => countByDay(entries), [entries]);
  const map = useMemo(() => buildHeatmap(counts, today, WEEKS), [counts, today]);
  const todayIso = toIsoDate(today);
  const view = activityView.useChoice();
  const [monthMeta, setMonthMeta] = useState('');
  const scrollerRef = useRef(null);

  /* Drag to pan, for a mouse. Touch and trackpads already scroll a sideways
     overflow natively, so only mouse and pen pointers are handled here.

     The pointer is only captured once it has actually moved past a few
     pixels. Capturing on press would retarget the click to the scroller, and
     a plain click on a day would stop opening the calendar. A real drag sets a
     flag that swallows the click it ends with, so letting go over a day does
     not open it. */
  const drag = useRef(null);
  const swallowClick = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [overflows, setOverflows] = useState(false);

  const onPointerDown = (e) => {
    // Browsers disagree on whether the click that ends a captured drag reaches
    // the grid. If it did not, the flag is still set; clear it here so it can
    // never swallow the next, genuine click.
    swallowClick.current = false;
    if (e.pointerType === 'touch' || e.button !== 0) return;
    const scroller = scrollerRef.current;
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return;
    drag.current = { id: e.pointerId, x: e.clientX, left: scroller.scrollLeft, moved: false };
  };

  const onPointerMove = (e) => {
    const state = drag.current;
    const scroller = scrollerRef.current;
    if (!state || !scroller || e.pointerId !== state.id) return;
    const dx = e.clientX - state.x;
    if (!state.moved) {
      if (Math.abs(dx) < 4) return;
      state.moved = true;
      setDragging(true);
      // Capture keeps the drag alive when the pointer leaves the grid. It
      // throws if the pointer is no longer active, which must not abort the
      // drag itself, so it is attempted rather than relied on.
      try {
        scroller.setPointerCapture(e.pointerId);
      } catch {
        // Dragging still works inside the grid without it.
      }
    }
    scroller.scrollLeft = state.left - dx;
  };

  const endDrag = (e) => {
    const state = drag.current;
    if (!state || e.pointerId !== state.id) return;
    if (state.moved) {
      swallowClick.current = true;
      setDragging(false);
      try {
        scrollerRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // Already released, or never captured.
      }
    }
    drag.current = null;
  };

  // Open on the most recent weeks, the way the grid is read: from now,
  // backwards. Before paint, so it never flashes the oldest months first.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || loadState !== 'ready' || view !== 'year') return undefined;
    scroller.scrollLeft = scroller.scrollWidth;
    // Whether there is anything to drag, so the grab cursor only appears when
    // dragging would do something.
    const measure = () => setOverflows(scroller.scrollWidth > scroller.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [loadState, view]);

  const summary =
    loadState !== 'ready'
      ? ''
      : map.total === 0
        ? 'No entries logged in the last year.'
        : `${map.total} ${map.total === 1 ? 'entry' : 'entries'} on ${map.activeDays} ` +
          `${map.activeDays === 1 ? 'day' : 'days'} in the last year.` +
          (map.busiest
            ? ` Busiest day: ${(() => {
                const d = parseIsoDate(map.busiest.iso);
                return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
              })()}, with ${map.busiest.count}.`
            : '');

  const pick = (e) => {
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
    const iso = e.target.closest('[data-iso]')?.getAttribute('data-iso');
    if (iso && iso <= todayIso) onPickDay?.(iso);
  };

  return (
    <section className="app-panel activity" aria-labelledby="dash-activity-title">
      <div className="app-panel__head">
        <h2 className="app-panel__title" id="dash-activity-title">
          Activity
        </h2>
        <div className="app-panel__spacer" />
        {loadState === 'ready' && (
          <span className="app-panel__meta">
            {view === 'year' ? `${map.total} in the last year` : monthMeta}
          </span>
        )}
        <div className="app-segments activity__views" role="group" aria-label="Activity view">
          <span
            className="app-segments__thumb"
            style={{ '--n': VIEWS.length, '--i': VIEWS.findIndex((v) => v.id === view) }}
            aria-hidden="true"
          />
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className="app-segment"
              aria-pressed={v.id === view}
              onClick={() => activityView.set(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {loadState === 'loading' && <p className="app-empty">Loading your year…</p>}

      {loadState === 'error' && (
        <div className="app-empty">
          <p>Couldn&rsquo;t load your activity.</p>
          <button type="button" className="app-btn app-btn--quiet app-btn--sm" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {loadState === 'ready' && view === 'month' && (
        <ActivityMonth
          counts={counts}
          today={today}
          scale={map.scale}
          onPickDay={onPickDay}
          onMeta={setMonthMeta}
        />
      )}

      {loadState === 'ready' && view === 'year' && (
        <div
          className={
            'activity__scroller' +
            (overflows ? ' activity__scroller--draggable' : '') +
            (dragging ? ' activity__scroller--dragging' : '')
          }
          ref={scrollerRef}
          // Focusable, so the arrow keys scroll it for someone without a
          // pointer; a region because it scrolls.
          tabIndex={overflows ? 0 : undefined}
          role={overflows ? 'region' : undefined}
          aria-label={overflows ? 'Activity for the last year, scrolls sideways' : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div
            className="activity__grid"
            style={{ '--weeks': WEEKS }}
            role="img"
            aria-label={summary}
            onClick={pick}
          >
            <div className="activity__months" aria-hidden="true">
              {map.months.map((m) => (
                <span key={`${m.col}-${m.label}`} style={{ gridColumn: m.col + 1 }}>
                  {m.label}
                </span>
              ))}
            </div>

            <div className="activity__weekdays" aria-hidden="true">
              <span style={{ gridRow: 1 }}>Mon</span>
              <span style={{ gridRow: 3 }}>Wed</span>
              <span style={{ gridRow: 5 }}>Fri</span>
            </div>

            <div className="activity__cells" aria-hidden="true">
              {map.columns.map((days, col) =>
                days.map((day, row) =>
                  day.future ? (
                    <span
                      key={day.iso}
                      className="activity__cell activity__cell--future"
                      style={{ gridColumn: col + 1, gridRow: row + 1 }}
                    />
                  ) : (
                    <span
                      key={day.iso}
                      data-iso={day.iso}
                      data-level={day.level}
                      className={
                        'activity__cell' + (day.iso === todayIso ? ' activity__cell--today' : '')
                      }
                      style={{ gridColumn: col + 1, gridRow: row + 1 }}
                      title={describeDay(day)}
                    />
                  ),
                ),
              )}
            </div>
          </div>
        </div>
      )}

      {loadState === 'ready' && (
        <div className="activity__legend" aria-hidden="true">
          <span>Less</span>
          {Array.from({ length: LEVELS + 1 }, (_, level) => (
            <span key={level} className="activity__cell activity__cell--legend" data-level={level} />
          ))}
          <span>More</span>
        </div>
      )}
    </section>
  );
}

const KEY_STEPS = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

/**
 * One month of the same squares, shaped like a calendar: a row per week, led
 * by Monday or Sunday as the calendar is set. Paging stays inside the year the
 * grid has loaded, from its first whole month to this one.
 *
 * The month is one tab stop. Arrow keys move between its days, Home and End
 * to the ends of the week; each day says what it holds, and the month as a
 * whole is summarised once for a screen reader.
 */
function ActivityMonth({ counts, today, scale, onPickDay, onMeta }) {
  const weekStart = useWeekStart();
  const thisMonth = startOfMonth(today);
  // The year grid's first day. A month that starts before it is only partly
  // loaded, so paging stops at the first whole month after it.
  const loadedFrom = addDays(startOfWeek(today), -7 * (WEEKS - 1));
  const firstMonth = loadedFrom.getDate() === 1 ? startOfMonth(loadedFrom) : addMonths(loadedFrom, 1);

  const [shown, setShown] = useState(thisMonth);
  const month = useMemo(
    () => buildMonth(counts, shown, weekStart, { today, scale }),
    [counts, shown, weekStart, today, scale],
  );
  const todayIso = toIsoDate(today);
  const canPrev = shown > firstMonth;
  const canNext = shown < thisMonth;

  // The days that can be opened: in this month and not after today.
  const open = useMemo(
    () => month.weeks.flat().filter((d) => !d.outside && !d.future).map((d) => d.iso),
    [month],
  );
  const [focusIso, setFocusIso] = useState(null);
  const current = open.includes(focusIso) ? focusIso : open.includes(todayIso) ? todayIso : open.at(-1);

  const gridRef = useRef(null);
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    gridRef.current?.querySelector(`[data-iso="${current}"]`)?.focus();
  }, [current]);

  const meta = `${month.total} in ${MONTHS[shown.getMonth()]}`;
  useEffect(() => {
    onMeta?.(meta);
  }, [meta, onMeta]);

  const page = (dir) => setShown((m) => addMonths(m, dir));

  const onKeyDown = (e) => {
    if (!current) return;
    let next;
    if (KEY_STEPS[e.key]) {
      next = toIsoDate(addDays(parseIsoDate(current), KEY_STEPS[e.key]));
    } else if (e.key === 'Home' || e.key === 'End') {
      const row = month.weeks.find((week) => week.some((d) => d.iso === current)) ?? [];
      const days = row.filter((d) => open.includes(d.iso));
      next = (e.key === 'Home' ? days[0] : days.at(-1))?.iso ?? null;
    } else {
      return;
    }
    e.preventDefault();
    // Stops at the edges of the month and at today rather than paging.
    if (next && open.includes(next)) {
      moved.current = true;
      setFocusIso(next);
    }
  };

  const titleId = 'dash-activity-month';
  const summaryId = 'dash-activity-month-summary';

  return (
    <div className="activity-month">
      <div className="activity-month__bar">
        <h3 className="activity-month__title" id={titleId}>
          {month.title}
        </h3>
        <button
          type="button"
          className="app-iconbtn"
          aria-label="Previous month"
          disabled={!canPrev}
          onClick={() => page(-1)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <button
          type="button"
          className="app-iconbtn"
          aria-label="Next month"
          disabled={!canNext}
          onClick={() => page(1)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <p className="app-sr" id={summaryId} aria-live="polite">
        {describeMonth(month)}
      </p>

      <div className="activity-month__dows" aria-hidden="true">
        {weekdayLabels(weekStart).map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div
        className="activity-month__grid"
        role="grid"
        aria-labelledby={titleId}
        aria-describedby={summaryId}
        ref={gridRef}
        onKeyDown={onKeyDown}
      >
        {month.weeks.map((week) => (
          <div className="activity-month__week" role="row" key={week[0].iso}>
            {week.map((day) => (
              <div className="activity-month__slot" role="gridcell" key={day.iso}>
                {day.outside ? null : day.future ? (
                  <span className="activity-month__day activity-month__day--future" aria-hidden="true">
                    {day.day}
                  </span>
                ) : (
                  <button
                    type="button"
                    className={
                      'activity-month__day' + (day.iso === todayIso ? ' activity-month__day--today' : '')
                    }
                    data-iso={day.iso}
                    data-level={day.level}
                    tabIndex={day.iso === current ? 0 : -1}
                    aria-label={describeDay(day) + (day.iso === todayIso ? ', today' : '')}
                    aria-current={day.iso === todayIso ? 'date' : undefined}
                    onFocus={() => setFocusIso(day.iso)}
                    onClick={() => onPickDay?.(day.iso)}
                  >
                    {day.day}
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
