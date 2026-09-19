import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import AppShell from '../components/AppShell';
import Modal from '../components/Modal';
import EventForm from '../components/EventForm';
import MonthGrid from '../components/MonthGrid';
import ImportCalendar from '../components/ImportCalendar';
import useDocumentTitle from '../hooks/useDocumentTitle';
import useEvents from '../hooks/useEvents';
import {
  DAY_MINUTES,
  HOUR_PX,
  SNAP_MINUTES,
  addDays,
  addMinutes,
  allDayOn,
  atMinutes,
  daysFrom,
  formatRange,
  layoutDay,
  parseLocal,
  sameDay,
  snapMinutes,
  startOfDay,
  startOfWeek,
  toLocalIso,
} from '../lib/planner';
import './calendar-page.css';

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = new Intl.DateTimeFormat(undefined, { hour: 'numeric' });
const dayName = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const monthYear = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const shortDay = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

const pxToMinutes = (px) => (px / HOUR_PX) * 60;
const minutesToPx = (min) => (min / 60) * HOUR_PX;

function useNarrow() {
  const query = '(max-width: 720px)';
  const [narrow, setNarrow] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return undefined;
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * The planner: a week (or, on a phone, a day) of hours, Google Calendar style.
 *
 * Press and drag down an empty column to block out time; release to name it.
 * Drag an event to move it, across days too; drag its bottom edge to change
 * its length. Everything snaps to fifteen minutes and commits on release, so
 * a drag never sends a request per pixel. For keyboard users, "New event" and
 * each event (a button) open the same form with every field editable.
 */
export default function Calendar() {
  useDocumentTitle('Calendar');
  const narrow = useNarrow();
  const now = useNow();
  const [view, setView] = useState(() => (window.matchMedia?.('(max-width: 720px)').matches ? 'day' : 'week'));
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [editor, setEditor] = useState(null); // { event } | { draft }
  const [pending, setPending] = useState(null); // a range being drawn: { dayIndex, a, b }
  const [drag, setDrag] = useState(null); // an event being moved or resized
  const [error, setError] = useState('');

  // A phone has no room for seven columns of hours: week becomes day there.
  // Month still works, as a grid of dots.
  const effectiveView = narrow && view === 'week' ? 'day' : view;
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start =
    effectiveView === 'month' ? startOfWeek(monthStart) : effectiveView === 'week' ? startOfWeek(anchor) : anchor;
  const count = effectiveView === 'month' ? 42 : effectiveView === 'week' ? 7 : 1;
  const [importing, setImporting] = useState(null); // { text, fileName }
  const [notice, setNotice] = useState('');
  const fileInput = useRef(null);
  const startKey = start.getTime();
  const days = useMemo(() => daysFrom(new Date(startKey), count), [startKey, count]);
  const { events, loadState, reload, create, update, remove } = useEvents(start, count);

  const scroller = useRef(null);
  const columns = useRef(null);

  // Open on the working day rather than on midnight, including when the
  // hours come back after the month view.
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = minutesToPx(7 * 60) - 8;
  }, [effectiveView]);

  // While dragging, lay the event out where it would land, so the grid
  // previews the drop exactly as it will look.
  const shown = useMemo(() => {
    if (!drag?.moved) return events;
    return events.map((e) =>
      e.id === drag.event.id ? { ...e, startsAt: toLocalIso(drag.start), endsAt: toLocalIso(drag.end) } : e,
    );
  }, [events, drag]);

  const step = (dir) =>
    setAnchor((a) =>
      effectiveView === 'month'
        ? new Date(a.getFullYear(), a.getMonth() + dir, 1)
        : addDays(a, dir * (effectiveView === 'week' ? 7 : 1)),
    );

  const openFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5_000_000) {
      setError('That file is over 5 MB. Export a shorter range from your calendar app.');
      return;
    }
    setError('');
    setImporting({ text: await file.text(), fileName: file.name });
  };

  const openDay = (day) => {
    setAnchor(startOfDay(day));
    setView('day');
  };

  const title = effectiveView === 'month'
    ? monthYear.format(monthStart)
    : effectiveView === 'week'
      ? `${shortDay.format(days[0])} – ${shortDay.format(days[6])}, ${days[6].getFullYear()}`
      : new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(days[0]);

  /* ── Drawing a new event on an empty column ── */

  const columnMinutes = (e, column) => {
    const rect = column.getBoundingClientRect();
    return snapMinutes(pxToMinutes(e.clientY - rect.top));
  };

  const onColumnDown = (e, dayIndex) => {
    if (e.button !== 0 || e.target !== e.currentTarget) return;
    const a = columnMinutes(e, e.currentTarget);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setPending({ dayIndex, a, b: Math.min(DAY_MINUTES, a + SNAP_MINUTES * 2) });
  };

  const onColumnMove = (e) => {
    if (!pending) return;
    const b = columnMinutes(e, e.currentTarget);
    setPending((p) => (p ? { ...p, b: b === p.a ? p.a + SNAP_MINUTES : b } : p));
  };

  const onColumnUp = () => {
    if (!pending) return;
    const day = days[pending.dayIndex];
    let lo = Math.min(pending.a, pending.b);
    let hi = Math.max(pending.a, pending.b);
    if (hi - lo < SNAP_MINUTES * 2) hi = Math.min(DAY_MINUTES, lo + 60);
    if (hi <= lo) lo = hi - 60;
    setPending(null);
    setEditor({ draft: { startsAt: toLocalIso(atMinutes(day, lo)), endsAt: toLocalIso(atMinutes(day, hi)), allDay: false } });
  };

  /* ── Moving and resizing an existing event ── */

  const onEventDown = (e, event, mode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({
      event,
      mode,
      x: e.clientX,
      y: e.clientY,
      moved: false,
      start: parseLocal(event.startsAt),
      end: parseLocal(event.endsAt),
    });
  };

  const onEventMove = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    const width = columns.current ? columns.current.getBoundingClientRect().width / count : 1;
    const dayShift = drag.mode === 'move' && count > 1 ? Math.round(dx / width) : 0;
    const minuteShift = Math.round(pxToMinutes(dy) / SNAP_MINUTES) * SNAP_MINUTES;
    const origStart = parseLocal(drag.event.startsAt);
    const origEnd = parseLocal(drag.event.endsAt);
    if (drag.mode === 'move') {
      const shift = minuteShift + dayShift * DAY_MINUTES;
      setDrag({ ...drag, moved: true, start: addMinutes(origStart, shift), end: addMinutes(origEnd, shift) });
    } else {
      const end = addMinutes(origEnd, minuteShift);
      const floor = addMinutes(origStart, SNAP_MINUTES);
      setDrag({ ...drag, moved: true, start: origStart, end: end < floor ? floor : end });
    }
  };

  const onEventUp = async () => {
    if (!drag) return;
    const { event, moved, start: s, end: en } = drag;
    setDrag(null);
    if (!moved) {
      setEditor({ event });
      return;
    }
    setError('');
    try {
      await update(event.id, { startsAt: toLocalIso(s), endsAt: toLocalIso(en) });
    } catch {
      setError("Couldn't move that event. It's back where it was.");
    }
  };

  /* ── Saving from the form ── */

  const save = async (body) => {
    if (editor.event) await update(editor.event.id, body);
    else await create(body);
    setEditor(null);
  };

  const del = async () => {
    try {
      await remove(editor.event.id);
      setEditor(null);
    } catch {
      setError("Couldn't delete that event. Check your connection and try again.");
    }
  };

  // Today at the next whole hour if today is on screen, else 9am on the
  // first day shown.
  const newEvent = () => {
    const showingToday = days.some((d) => sameDay(d, now));
    const day = showingToday ? now : days[0];
    const startMin = showingToday ? (now.getHours() + 1) * 60 : 9 * 60;
    setEditor({
      draft: {
        startsAt: toLocalIso(atMinutes(day, Math.min(startMin, DAY_MINUTES - 60))),
        endsAt: toLocalIso(atMinutes(day, Math.min(startMin + 60, DAY_MINUTES))),
        allDay: false,
      },
    });
  };

  const hasAllDay = days.some((d) => allDayOn(shown, d).length > 0);

  return (
    <AppShell
      title="Calendar"
      action={
        <button type="button" className="app-btn" onClick={newEvent}>
          New event
        </button>
      }
    >
      <div className="cal">
        <div className="cal__bar">
          <button type="button" className="app-btn app-btn--quiet app-btn--sm" onClick={() => setAnchor(startOfDay(new Date()))}>
            Today
          </button>
          <div className="cal__nav">
            <button type="button" className="app-iconbtn" onClick={() => step(-1)} aria-label={`Previous ${effectiveView}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <button type="button" className="app-iconbtn" onClick={() => step(1)} aria-label={`Next ${effectiveView}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <h2 className="cal__title">{title}</h2>
          {effectiveView !== 'month' && <span className="cal__month">{monthYear.format(days[0])}</span>}
          <div className="app-panel__spacer" />
          <input
            ref={fileInput}
            type="file"
            accept=".ics,text/calendar"
            className="app-sr"
            tabIndex={-1}
            aria-hidden="true"
            onChange={openFile}
          />
          <button
            type="button"
            className="app-btn app-btn--quiet app-btn--sm cal__import"
            onClick={() => fileInput.current?.click()}
            title="Import events from Google Calendar, Apple Calendar or Outlook (.ics)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14" />
            </svg>
            Import .ics
          </button>
          {(() => {
            const views = narrow ? ['day', 'month'] : ['day', 'week', 'month'];
            return (
              <div className="app-segments cal__views" role="group" aria-label="View" style={{ width: views.length * 72 }}>
                <span
                  className="app-segments__thumb"
                  style={{ '--n': views.length, '--i': Math.max(0, views.indexOf(effectiveView)) }}
                  aria-hidden="true"
                />
                {views.map((v) => (
                  <button key={v} type="button" className="app-segment" aria-pressed={effectiveView === v} onClick={() => setView(v)}>
                    {v[0].toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>

        {notice && (
          <p className="cal__notice" role="status">
            {notice}
            <button type="button" className="app-linkbtn" onClick={() => setNotice('')}>
              Dismiss
            </button>
          </p>
        )}

        {error && (
          <p className="app-form__error" role="alert">
            {error}
          </p>
        )}
        {loadState === 'error' && (
          <div className="app-empty">
            <p>Couldn&rsquo;t load your calendar.</p>
            <button type="button" className="app-btn app-btn--quiet app-btn--sm" onClick={reload}>
              Try again
            </button>
          </div>
        )}

        {effectiveView === 'month' ? (
          <div className="app-panel cal__panel">
            <MonthGrid
              days={days}
              month={monthStart.getMonth()}
              events={events}
              now={now}
              onOpenDay={openDay}
              onOpenEvent={(ev) => setEditor({ event: ev })}
              onNew={(day) =>
                setEditor({
                  draft: {
                    startsAt: toLocalIso(atMinutes(day, 9 * 60)),
                    endsAt: toLocalIso(atMinutes(day, 10 * 60)),
                    allDay: false,
                  },
                })
              }
            />
          </div>
        ) : (
        <div className="app-panel cal__panel" style={{ '--days': count }}>
          <div className="cal__head">
            <span className="cal__gutter" />
            {days.map((d) => (
              <button
                key={d.toISOString()}
                type="button"
                className={`cal__day-head${sameDay(d, now) ? ' cal__day-head--today' : ''}`}
                onClick={() => {
                  setAnchor(d);
                  setView('day');
                }}
                aria-label={`Show ${d.toDateString()}`}
              >
                <span>{dayName.format(d)}</span>
                <strong>{d.getDate()}</strong>
              </button>
            ))}
          </div>

          {hasAllDay && (
            <div className="cal__allday">
              <span className="cal__gutter cal__gutter--label">All day</span>
              {days.map((d) => (
                <div key={d.toISOString()} className="cal__allday-cell">
                  {allDayOn(shown, d).map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      className={`cal__chip ev--${ev.color ?? 'accent'}`}
                      onClick={() => setEditor({ event: ev })}
                    >
                      {ev.title}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="cal__scroller" ref={scroller}>
            <div className="cal__grid" style={{ height: minutesToPx(DAY_MINUTES) }}>
              <div className="cal__hours" aria-hidden="true">
                {HOURS.map((h) => (
                  <span key={h} style={{ top: minutesToPx(h * 60) }}>
                    {h === 0 ? '' : hourLabel.format(new Date(2000, 0, 1, h))}
                  </span>
                ))}
              </div>

              <div className="cal__cols" ref={columns}>
                {days.map((d, dayIndex) => {
                  const items = layoutDay(shown, d);
                  const isToday = sameDay(d, now);
                  return (
                    <div
                      key={d.toISOString()}
                      className={`cal__col${isToday ? ' cal__col--today' : ''}`}
                      onPointerDown={(e) => onColumnDown(e, dayIndex)}
                      onPointerMove={onColumnMove}
                      onPointerUp={onColumnUp}
                      onPointerCancel={() => setPending(null)}
                    >
                      {pending?.dayIndex === dayIndex && (
                        <div
                          className="cal__pending"
                          style={{
                            top: minutesToPx(Math.min(pending.a, pending.b)),
                            height: minutesToPx(Math.abs(pending.b - pending.a)),
                          }}
                        />
                      )}

                      {items.map(({ event, top, bottom, column, columns: n }) => {
                        const held = drag?.event.id === event.id && drag.moved;
                        const short = bottom - top < 45;
                        return (
                          <div
                            key={event.id}
                            className={`cal__event ev--${event.color ?? 'accent'}${held ? ' cal__event--held' : ''}${short ? ' cal__event--short' : ''}`}
                            style={{
                              top: minutesToPx(top),
                              height: minutesToPx(bottom - top) - 2,
                              left: `calc(${(column / n) * 100}% + 2px)`,
                              width: `calc(${100 / n}% - 4px)`,
                            }}
                            onPointerDown={(e) => onEventDown(e, event, 'move')}
                            onPointerMove={onEventMove}
                            onPointerUp={onEventUp}
                            onPointerCancel={() => setDrag(null)}
                          >
                            <button
                              type="button"
                              className="cal__event-body"
                              onClick={(e) => {
                                // Pointer clicks are handled on release above;
                                // this is the keyboard path.
                                if (e.detail === 0) setEditor({ event });
                              }}
                            >
                              <strong>{event.title}</strong>
                              {!short && <span>{formatRange(event)}</span>}
                              {!short && event.placeName && <span className="app-trunc">{event.placeName}</span>}
                            </button>
                            <span
                              className="cal__resize"
                              aria-hidden="true"
                              onPointerDown={(e) => onEventDown(e, event, 'resize')}
                            />
                          </div>
                        );
                      })}

                      {isToday && (
                        <div className="cal__now" style={{ top: minutesToPx(now.getHours() * 60 + now.getMinutes()) }} aria-hidden="true" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        )}

        {loadState === 'ready' && events.length === 0 && effectiveView !== 'month' && (
          <p className="cal__hint">Press and drag on the grid to block out time, or use New event.</p>
        )}
      </div>

      {importing && (
        <Modal title="Import a calendar" onClose={() => setImporting(null)}>
          <ImportCalendar
            text={importing.text}
            fileName={importing.fileName}
            onCancel={() => setImporting(null)}
            onDone={({ imported, skipped }) => {
              setImporting(null);
              setNotice(
                `Imported ${imported} event${imported === 1 ? '' : 's'}` +
                  (skipped ? `; ${skipped} could not be used.` : '.'),
              );
              reload();
            }}
          />
        </Modal>
      )}

      {editor && (
        <Modal title={editor.event ? 'Edit event' : 'New event'} onClose={() => setEditor(null)}>
          <EventForm
            event={editor.event}
            draft={editor.draft}
            onSave={save}
            onDelete={del}
            onCancel={() => setEditor(null)}
          />
        </Modal>
      )}
    </AppShell>
  );
}
