import { formatTime, onDay, parseLocal, sameDay } from '../lib/planner';
import { weekdayLabels } from '../lib/weekStart';
import { goalIcon } from '../lib/categories';
import FeedMark from './FeedMark';

const SHOWN = 3;
const dayLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

/**
 * A month, six weeks led by Monday or Sunday (the person's choice, passed in
 * as `weekStart`; `days` already starts on it), the way Google Calendar lays
 * one out.
 *
 * Each day lists its events, all-day ones first, then timed ones by start;
 * past three it says how many more and opens the day. The date number opens
 * that day's hours; the empty part of a day starts a new event on it. On a
 * phone the chips shrink to coloured dots, one per event, so the month still
 * reads as a whole.
 *
 * `planned(day)`, when given, lists the goals planned for that weekday as
 * { goal, done }; each shows as a small mark of its icon above the events,
 * filled once done that day, and the date's name says which.
 *
 * An event copied from a connected Google Calendar (with a `feedId`) carries
 * a small link mark, and `sourceLabel(event)` adds where it came from to its
 * name; opening it is the page's business, through `onOpenEvent`.
 */
const noPlans = () => [];
const noSource = () => '';

export default function MonthGrid({
  days,
  weekStart = 'monday',
  month,
  events,
  planned = noPlans,
  now,
  onOpenDay,
  onNew,
  onOpenEvent,
  sourceLabel = noSource,
}) {
  return (
    <div className="month">
      {/* The day letters are decoration: each date button already says its
          weekday in full. No grid role either, since arrow keys do not move
          through the days; the buttons stand on their own. */}
      <div className="month__head" aria-hidden="true">
        {weekdayLabels(weekStart).map((d) => (
          <span key={d}>{d}</span>
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
          const plans = planned(day);
          const plansLabel = plans.length
            ? ', planned: ' + plans.map(({ goal, done }) => goal.title + (done ? ', done' : '')).join('; ')
            : '';
          return (
            <div
              key={day.toISOString()}
              className={`month__day${outside ? ' month__day--outside' : ''}${today ? ' month__day--today' : ''}`}
              onClick={(e) => {
                if (e.target === e.currentTarget) onNew(day);
              }}
            >
              <button
                type="button"
                className="month__date"
                onClick={() => onOpenDay(day)}
                aria-label={`${dayLabel.format(day)}${items.length ? `, ${items.length} event${items.length === 1 ? '' : 's'}` : ''}${plansLabel}`}
              >
                {day.getDate()}
              </button>
              {plans.length > 0 && (
                <span className="month__goals" aria-hidden="true">
                  {plans.map(({ goal, done }) => (
                    <span
                      key={goal.id}
                      className={'month__goal' + (done ? ' month__goal--done' : '')}
                      title={goal.title + (done ? ', done' : '')}
                    >
                      {goalIcon(goal)}
                    </span>
                  ))}
                </span>
              )}
              <ul className="month__events">
                {items.slice(0, SHOWN).map((ev) => (
                  <li key={`${ev.id}-${day.getDate()}`}>
                    <button
                      type="button"
                      className={`month__event ev--${ev.color ?? 'accent'}${ev.allDay ? ' month__event--allday' : ''}${ev.feedId ? ' month__event--feed' : ''}`}
                      onClick={() => onOpenEvent(ev)}
                      title={`${ev.title}${sourceLabel(ev)}`}
                      aria-label={ev.feedId ? `${ev.title}${sourceLabel(ev)}` : undefined}
                    >
                      {ev.feedId && <FeedMark size={10} />}
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
