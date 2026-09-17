import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import useLogHistory from '../hooks/useLogHistory';
import { LEVELS, buildHeatmap, countByDay, describeDay } from '../lib/activity';
import { parseIsoDate, toIsoDate } from '../pages/dashboardData';
import './activity.css';

const WEEKS = 53;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
 */
export default function ActivityHeatmap({ today, reloadKey, onPickDay }) {
  const { entries, loadState, retry } = useLogHistory(today, WEEKS, reloadKey);
  const map = useMemo(() => buildHeatmap(countByDay(entries), today, WEEKS), [entries, today]);
  const todayIso = toIsoDate(today);
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
    if (!scroller || loadState !== 'ready') return undefined;
    scroller.scrollLeft = scroller.scrollWidth;
    // Whether there is anything to drag, so the grab cursor only appears when
    // dragging would do something.
    const measure = () => setOverflows(scroller.scrollWidth > scroller.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [loadState]);

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
            {map.total} in the last year
          </span>
        )}
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

      {loadState === 'ready' && (
        <>
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

          <div className="activity__legend" aria-hidden="true">
            <span>Less</span>
            {Array.from({ length: LEVELS + 1 }, (_, level) => (
              <span key={level} className="activity__cell activity__cell--legend" data-level={level} />
            ))}
            <span>More</span>
          </div>
        </>
      )}
    </section>
  );
}
