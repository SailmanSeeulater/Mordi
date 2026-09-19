import { Link } from 'react-router-dom';
import useEvents from '../hooks/useEvents';
import { formatRange, parseLocal, startOfDay } from '../lib/planner';
import '../pages/calendar-page.css';

/**
 * Today's plan, on the dashboard: what is on the calendar today, in order,
 * with anything already over dimmed. The full calendar is one tap away.
 */
export default function PlanToday({ today }) {
  const day = startOfDay(today);
  const { events, loadState, reload } = useEvents(day, 1);
  const now = new Date();
  const sorted = [...events].sort(
    (a, b) => Number(b.allDay) - Number(a.allDay) || parseLocal(a.startsAt) - parseLocal(b.startsAt),
  );

  return (
    <section className="app-panel" aria-labelledby="dash-plan-title">
      <div className="app-panel__head">
        <h2 className="app-panel__title" id="dash-plan-title">
          Today&rsquo;s plan
        </h2>
        <div className="app-panel__spacer" />
        <Link to="/calendar" className="app-btn app-btn--quiet app-btn--sm">
          Open calendar
        </Link>
      </div>

      {loadState === 'loading' && <p className="app-empty">Loading today&rsquo;s plan…</p>}
      {loadState === 'error' && (
        <div className="app-empty">
          <p>Couldn&rsquo;t load today&rsquo;s plan.</p>
          <button type="button" className="app-btn app-btn--quiet app-btn--sm" onClick={reload}>
            Try again
          </button>
        </div>
      )}
      {loadState === 'ready' && sorted.length === 0 && (
        <p className="app-empty">Nothing planned today. Block out time on the calendar.</p>
      )}
      {loadState === 'ready' && sorted.length > 0 && (
        <ul className="plan-today__list">
          {sorted.map((ev) => (
            <li
              key={ev.id}
              className={`plan-today__item ev--${ev.color ?? 'accent'}${
                !ev.allDay && parseLocal(ev.endsAt) < now ? ' plan-today__item--past' : ''
              }`}
            >
              <span className="plan-today__time">{formatRange(ev)}</span>
              <span className="plan-today__title">{ev.title}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
