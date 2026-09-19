import { formatTime, onDay, parseLocal, sameDay } from '../lib/planner';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SHOWN = 3;
const dayLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

/**
 * A month, six Monday-led weeks, the way Google Calendar lays one out.
 *
 * Each day lists its events, all-day ones first, then timed ones by start;
 * past three it says how many more and opens the day. The date number opens
 * that day's hours; the empty part of a day starts a new event on it. On a
 * phone the chips shrink to coloured dots, one per event, so the month still
 * reads as a whole.
 */
export default function MonthGrid({ days, month, events, now, onOpenDay, onNew, onOpenEvent }) {
  return (
    <div className="month" role="grid" aria-label="Month">
      <div className="month__head" role="row">
        {WEEKDAYS.map((d) => (
          <span key={d} role="columnheader">
            {d}
          </span>
        ))}
      </div>
      <div className="month__body">
        {days.map((day) => {
          const items = events
            .filter((e) => onDay(e, day))
            .sort(
              (a, b) =>
                Number(b.allDay) - Number(a.allDay) || parseLocal(a.startsAt) - parseLocal(b.startsAt),
            );
          const outside = day.getMonth() !== month;
          const today = sameDay(day, now);
          const extra = items.length - SHOWN;
          return (
            <div
              key={day.toISOString()}
              role="gridcell"
              className={`month__day${outside ? ' month__day--outside' : ''}${today ? ' month__day--today' : ''}`}
              onClick={(e) => {
                if (e.target === e.currentTarget) onNew(day);
              }}
            >
              <button
                type="button"
                className="month__date"
                onClick={() => onOpenDay(day)}
                aria-label={`${dayLabel.format(day)}${items.length ? `, ${items.length} event${items.length === 1 ? '' : 's'}` : ''}`}
              >
                {day.getDate()}
              </button>
              <ul className="month__events">
                {items.slice(0, SHOWN).map((ev) => (
                  <li key={`${ev.id}-${day.getDate()}`}>
                    <button
                      type="button"
                      className={`month__event ev--${ev.color ?? 'accent'}${ev.allDay ? ' month__event--allday' : ''}`}
                      onClick={() => onOpenEvent(ev)}
                      title={ev.title}
                    >
                      {!ev.allDay && <span className="month__time">{formatTime(parseLocal(ev.startsAt))}</span>}
                      <span className="month__title">{ev.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {extra > 0 && (
                <button type="button" className="month__more" onClick={() => onOpenDay(day)}>
                  {extra} more
                </button>
              )}
              {items.length > 0 && (
                <span className="month__dots" aria-hidden="true">
                  {items.slice(0, 4).map((ev) => (
                    <span key={`${ev.id}-dot`} className={`month__dot ev--${ev.color ?? 'accent'}`} />
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
