import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import Modal from './Modal';
import { addDays, addMonths, monthGrid, startOfMonth, toIsoDate } from '../pages/dashboardData';
import './calendar.css';

const DOWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MOOD_TONE = { great: 'up', good: 'up', neutral: 'flat', bad: 'down', terrible: 'down' };
const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');

const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const longDate = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

/**
 * A month at a glance: every day carries whether anything was logged, and
 * picking one lists that day's entries. Entries already loaded by the
 * dashboard seed the view; paging to another month fetches that range.
 */
export default function CalendarModal({
  behaviors,
  today,
  initialSelected,
  onClose,
  onLogDay,
}) {
  const todayIso = toIsoDate(today);
  const opensOn = initialSelected ?? todayIso;
  const [month, setMonth] = useState(() => startOfMonth(new Date(`${opensOn}T00:00:00`)));
  const [selected, setSelected] = useState(opensOn);
  const [loaded, setLoaded] = useState(() => (Array.isArray(behaviors) ? behaviors : []));
  const [loadState, setLoadState] = useState('ready');

  const monthStart = toIsoDate(month);
  const monthEnd = toIsoDate(addDays(addMonths(month, 1), -1));

  const showMonth = (next) => {
    setMonth(next);
    setLoadState('loading');
  };

  // Page to a month the dashboard didn't already load and fetch just that range.
  useEffect(() => {
    let cancelled = false;
    client
      .get('/api/behaviors/range', { params: { start: monthStart, end: monthEnd } })
      .then((res) => {
        if (cancelled) return;
        if (!Array.isArray(res.data)) {
          setLoadState('error');
          return;
        }
        setLoaded(res.data);
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [monthStart, monthEnd]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const entry of loaded) {
      if (!map.has(entry.logDate)) map.set(entry.logDate, []);
      map.get(entry.logDate).push(entry);
    }
    return map;
  }, [loaded]);

  const days = useMemo(() => monthGrid(month), [month]);
  const selectedEntries = byDay.get(selected) ?? [];

  const dayClass = (day) => {
    const entries = byDay.get(day.iso) ?? [];
    const done = entries.some((e) => e.completed);
    return [
      'cal__day',
      day.outside ? 'cal__day--outside' : '',
      done ? 'cal__day--done' : entries.length > 0 ? 'cal__day--partial' : '',
      !done && entries.length === 0 && day.iso < todayIso ? 'cal__day--missed' : '',
      day.iso === todayIso ? 'cal__day--today' : '',
      day.iso === selected ? 'cal__day--selected' : '',
    ]
      .filter(Boolean)
      .join(' ');
  };

  return (
    <Modal title="Your month" onClose={onClose}>
      <div className="cal">
        <div className="cal__head">
          <h3 className="cal__month">{monthLabel.format(month)}</h3>
          <button
            type="button"
            className="app-iconbtn"
            aria-label="Previous month"
            onClick={() => showMonth(addMonths(month, -1))}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true" focusable="false">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            className="app-iconbtn"
            aria-label="Next month"
            onClick={() => showMonth(addMonths(month, 1))}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true" focusable="false">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="cal__dows" aria-hidden="true">
          {DOWS.map((d) => (
            <div className="cal__dow" key={d}>
              {d[0]}
            </div>
          ))}
        </div>

        <div className="cal__grid" role="group" aria-label={`Days in ${monthLabel.format(month)}`}>
          {days.map((day) => {
            const entries = byDay.get(day.iso) ?? [];
            return (
              <button
                key={day.iso}
                type="button"
                className={dayClass(day)}
                aria-pressed={day.iso === selected}
                onClick={() => setSelected(day.iso)}
              >
                <span aria-hidden="true">{day.date.getDate()}</span>
                {entries.length > 0 && (
                  <span className="cal__count" aria-hidden="true">
                    {entries.length}
                  </span>
                )}
                <span className="app-sr">
                  {longDate.format(day.date)}
                  {entries.length === 0
                    ? ', nothing logged'
                    : `, ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`}
                  {day.iso === todayIso ? ', today' : ''}
                </span>
              </button>
            );
          })}
        </div>

        <p className="cal__legend">
          <span>
            <span className="cal__key cal__key--done" aria-hidden="true" /> Logged
          </span>
          <span>
            <span className="cal__key cal__key--partial" aria-hidden="true" /> Logged, not done
          </span>
          <span>
            <span className="cal__key cal__key--missed" aria-hidden="true" /> Nothing
          </span>
        </p>

        {loadState === 'error' && (
          <p className="cal__status" role="alert">
            Couldn&rsquo;t load this month. Showing what was already loaded.
          </p>
        )}

        <div className="cal__selected">
          <h4 className="cal__selected-title">{longDate.format(new Date(`${selected}T00:00:00`))}</h4>
          {selectedEntries.length === 0 ? (
            <p className="cal__empty">
              {loadState === 'loading' ? 'Loading…' : 'Nothing logged on this day.'}
            </p>
          ) : (
            <ul className="cal__entries">
              {selectedEntries.map((entry) => (
                <li className="cal__entry" key={entry.id}>
                  <div className="cal__entry-top">
                    <span className="cal__entry-goal">
                      {entry.goal ? entry.goal.title : 'No goal'}
                    </span>
                    {entry.mood && (
                      <span className={`mood mood--${MOOD_TONE[entry.mood] ?? 'flat'}`}>
                        {capitalize(entry.mood)}
                      </span>
                    )}
                  </div>
                  <p className="cal__entry-note">{entry.note}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="app-form__actions" style={{ paddingTop: 16 }}>
          <button type="button" className="app-btn app-btn--ghost" onClick={onClose}>
            Close
          </button>
          {selected === todayIso && (
            <button type="button" className="app-btn" onClick={onLogDay}>
              Log today
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
