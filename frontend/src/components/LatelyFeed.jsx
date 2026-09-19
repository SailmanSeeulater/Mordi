import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { groupByDay } from '../lib/feed';
import { describeDuration, formatDuration } from '../lib/timer';
import { parseIsoDate } from '../pages/dashboardData';
import './lately.css';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MOOD_TONE = { great: 'up', good: 'up', neutral: 'flat', bad: 'down', terrible: 'down' };
const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');

/** Pixels per second. Slow enough to read a line as it passes. */
const SPEED = 24;

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function dayLabel(iso, todayIso) {
  if (iso === todayIso) return 'Today';
  const date = parseIsoDate(iso);
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

const pin = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z" />
    <circle cx="12" cy="10" r="2.6" />
  </svg>
);

function Groups({ groups, todayIso }) {
  return groups.map((group) => (
    <li className="lately__day" key={group.iso}>
      <p className="lately__date">{dayLabel(group.iso, todayIso)}</p>
      <ul className="lately__entries">
        {group.entries.map((entry) => (
          <li className="lately__entry" key={entry.id}>
            <div className="lately__top">
              <p className="lately__note">{entry.note}</p>
              {entry.durationSeconds != null && (
                <span className="lately__duration">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M12 7.5V12l3 2" />
                  </svg>
                  <span aria-hidden="true">{formatDuration(entry.durationSeconds)}</span>
                  <span className="app-sr">{describeDuration(entry.durationSeconds)}</span>
                </span>
              )}
              {entry.mood && (
                <span className={`mood mood--${MOOD_TONE[entry.mood] ?? 'flat'}`}>
                  {capitalize(entry.mood)}
                </span>
              )}
            </div>
            {(entry.goal || entry.placeName) && (
              <div className="lately__foot">
                {entry.goal && <span className="lately__goal">{entry.goal.title}</span>}
                {entry.placeName && (
                  <span className="lately__place">
                    {pin}
                    <span className="app-trunc">{entry.placeName}</span>
                  </span>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </li>
  ));
}

/**
 * The entry feed, as a fixed-height window that drifts upward on its own when
 * there is more than fits — the same moving list the landing page shows off.
 *
 * Motion is driven by a transform while it plays, so it moves smoothly at
 * sub-pixel speeds. Stopping it hands the same position to the element's own
 * scroll, so a paused feed is an ordinary list that a wheel, a finger or the
 * keyboard scroll normally, from exactly where it stopped. Starting it again
 * picks up from wherever it was left.
 *
 * Stops on a click or tap anywhere in it, when the pointer grabs it with a
 * wheel or a touch, or from the pause button, which keyboard and screen reader
 * users need because moving content has to be stoppable without a pointer.
 * Under prefers-reduced-motion it never moves at all.
 *
 * The groups are rendered twice so the loop has no seam; the second copy is
 * hidden from assistive technology and cannot take focus.
 */
export default function LatelyFeed({ entries, todayIso, weekCount }) {
  const groups = useMemo(() => groupByDay(entries), [entries]);

  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const firstRef = useRef(null);
  const secondRef = useRef(null);
  const offset = useRef(0);

  const [overflowing, setOverflowing] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reduced] = useState(reducedMotion);
  const [visible, setVisible] = useState(true);

  const playing = overflowing && !paused && !reduced && visible;

  // Whether one copy of the list is taller than the window. Measured before
  // paint, and again whenever either box changes size.
  useLayoutEffect(() => {
    const measure = () => {
      const viewport = viewportRef.current;
      const first = firstRef.current;
      if (!viewport || !first) return;
      setOverflowing(first.offsetHeight > viewport.clientHeight + 4);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    if (viewportRef.current) observer.observe(viewportRef.current);
    if (firstRef.current) observer.observe(firstRef.current);
    return () => observer.disconnect();
  }, [groups]);

  // No work at all while the feed is off screen.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || !viewportRef.current) return undefined;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);

  // The drift. The distance of one loop is the gap from the top of the first
  // copy to the top of the second, so wrapping lands on an identical frame.
  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!playing || !viewport || !track) return undefined;

    // Take over from wherever the list was scrolled to by hand.
    offset.current = viewport.scrollTop;
    viewport.scrollTop = 0;

    let frame;
    let last = performance.now();
    const step = (now) => {
      const loop = (secondRef.current?.offsetTop ?? 0) - (firstRef.current?.offsetTop ?? 0);
      // Capped, so returning to a background tab does not jump the list.
      const dt = Math.min(now - last, 64);
      last = now;
      offset.current += (SPEED * dt) / 1000;
      if (loop > 0 && offset.current >= loop) offset.current -= loop;
      track.style.transform = `translate3d(0, ${-offset.current}px, 0)`;
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
      // Hand the position back to the native scroll, so stopping is seamless.
      track.style.transform = '';
      viewport.scrollTop = Math.round(offset.current);
    };
  }, [playing]);

  const pause = useCallback(() => setPaused(true), []);
  const toggle = useCallback(() => setPaused((p) => !p), []);

  // Keyboard focus stops the drift, so someone tabbing in can read and scroll.
  // Pointer focus must not: a click focuses first and then clicks, so pausing
  // here would be undone by the click's own toggle a moment later.
  const pauseOnKeyboardFocus = useCallback((e) => {
    if (e.target === e.currentTarget && e.currentTarget.matches(':focus-visible')) {
      setPaused(true);
    }
  }, []);

  const empty = groups.length === 0;

  return (
    <section className="lately" aria-labelledby="dash-feed-title">
      <div className="app-panel__head">
        <h2 className="app-panel__title" id="dash-feed-title">
          Lately
        </h2>
        <div className="app-panel__spacer" />
        <span className="app-panel__meta">{weekCount} this week</span>
        {overflowing && !reduced && (
          <button
            type="button"
            className="app-iconbtn app-iconbtn--sm"
            onClick={toggle}
            aria-pressed={paused}
            aria-label={paused ? 'Resume scrolling the feed' : 'Pause scrolling the feed'}
            title={paused ? 'Resume' : 'Pause'}
          >
            {paused ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
                <rect x="6.5" y="5" width="4" height="14" rx="1" />
                <rect x="13.5" y="5" width="4" height="14" rx="1" />
              </svg>
            )}
          </button>
        )}
      </div>

      {empty ? (
        <p className="app-empty">Nothing logged yet. Your entries show up here.</p>
      ) : (
        <div
          ref={viewportRef}
          className={
            'lately__viewport' +
            (overflowing ? ' lately__viewport--overflow' : '') +
            (playing ? ' lately__viewport--playing' : '')
          }
          // A scrolling region has to be reachable from the keyboard.
          tabIndex={overflowing ? 0 : undefined}
          role={overflowing ? 'region' : undefined}
          aria-label={overflowing ? 'Recent entries' : undefined}
          onClick={overflowing && !reduced ? toggle : undefined}
          onWheel={playing ? pause : undefined}
          onTouchStart={playing ? pause : undefined}
          onFocus={playing ? pauseOnKeyboardFocus : undefined}
        >
          <div ref={trackRef} className="lately__track">
            <ul ref={firstRef} className="lately__copy">
              <Groups groups={groups} todayIso={todayIso} />
            </ul>
            {overflowing && !reduced && (
              <ul ref={secondRef} className="lately__copy" aria-hidden="true" inert>
                <Groups groups={groups} todayIso={todayIso} />
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
