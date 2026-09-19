import { useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import useEvents from '../hooks/useEvents';
import { addDays, formatRange, matchGoal, parseLocal, sameDay, startOfDay } from '../lib/planner';
import '../pages/calendar-page.css';

/**
 * Today's plan, and whether it happened.
 *
 * Today's events in order, anything over dimmed. A timed block that has
 * ended asks "did it happen?": Done logs an ordinary entry for it (against
 * the goal its title matches, if any) and Skip says no. Yesterday's
 * unanswered blocks stay here until answered, so an evening's plan can be
 * closed out the next morning. Every answer can be taken back.
 */
export default function PlanToday({ today, goals = [], onChanged, onToast }) {
  const day = startOfDay(today);
  const yesterday = addDays(day, -1);
  const { events, loadState, reload } = useEvents(yesterday, 2);
  const [busyId, setBusyId] = useState(null);
  const now = new Date();

  const ended = (e) => !e.allDay && parseLocal(e.endsAt) <= now;
  const todays = events
    .filter((e) => sameDay(parseLocal(e.startsAt), day) || (e.allDay && parseLocal(e.endsAt) > day))
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || parseLocal(a.startsAt) - parseLocal(b.startsAt));
  const leftover = events.filter(
    (e) => sameDay(parseLocal(e.startsAt), yesterday) && ended(e) && !e.outcome,
  );

  const answer = async (event, outcome) => {
    setBusyId(event.id);
    const goal = outcome === 'done' ? matchGoal(event, goals) : null;
    try {
      await client.put(`/api/events/${event.id}/outcome`, { outcome, goalId: goal?.id ?? null });
      await reload();
      onChanged?.();
      onToast?.({
        message: outcome === 'done' ? `Logged “${event.title}”${goal ? ` for ${goal.title}` : ''}` : `Skipped “${event.title}”`,
        undo: async () => {
          await client.delete(`/api/events/${event.id}/outcome`);
          await reload();
          onChanged?.();
        },
      });
    } catch {
      onToast?.({ message: "Couldn't save that. Check your connection and try again.", undoable: false });
    } finally {
      setBusyId(null);
    }
  };

  const item = (ev, isLeftover = false) => {
    const past = ended(ev);
    const goal = matchGoal(ev, goals);
    return (
      <li
        key={ev.id}
        className={`plan-today__item ev--${ev.color ?? 'accent'}${past && !isLeftover ? ' plan-today__item--past' : ''}`}
      >
        <span className="plan-today__time">{isLeftover ? 'Yesterday' : formatRange(ev)}</span>
        <span className="plan-today__title">{ev.title}</span>
        {past && (
          <span className="plan-today__answer">
            {ev.outcome === 'done' && <span className="plan-today__state plan-today__state--done">Done</span>}
            {ev.outcome === 'skipped' && <span className="plan-today__state">Skipped</span>}
            {!ev.outcome && (
              <>
                <span className="app-sr">Did {ev.title} happen?</span>
                <button
                  type="button"
                  className="plan-today__btn plan-today__btn--done"
                  onClick={() => answer(ev, 'done')}
                  disabled={busyId === ev.id}
                  title={goal ? `Log it, counting toward ${goal.title}` : 'Log it as done'}
                >
                  Done
                </button>
                <button
                  type="button"
                  className="plan-today__btn"
                  onClick={() => answer(ev, 'skipped')}
                  disabled={busyId === ev.id}
                >
                  Skip
                </button>
              </>
            )}
          </span>
        )}
      </li>
    );
  };

  const unanswered = [...leftover, ...todays].filter((e) => ended(e) && !e.outcome).length;

  return (
    <section className="app-panel" aria-labelledby="dash-plan-title">
      <div className="app-panel__head">
        <h2 className="app-panel__title" id="dash-plan-title">
          Today&rsquo;s plan
        </h2>
        {unanswered > 0 && (
          <span className="app-panel__meta">
            {unanswered} to close out
          </span>
        )}
        <div className="app-panel__spacer" />
        <Link to="/calendar" className="app-btn app-btn--quiet app-btn--sm">
          Open calendar
        </Link>
      </div>

      {loadState === 'loading' && <p className="app-empty">Loading today&rsquo;s plan&hellip;</p>}
      {loadState === 'error' && (
        <div className="app-empty">
          <p>Couldn&rsquo;t load today&rsquo;s plan.</p>
          <button type="button" className="app-btn app-btn--quiet app-btn--sm" onClick={reload}>
            Try again
          </button>
        </div>
      )}
      {loadState === 'ready' && todays.length === 0 && leftover.length === 0 && (
        <p className="app-empty">Nothing planned today. Block out time on the calendar.</p>
      )}
      {loadState === 'ready' && (todays.length > 0 || leftover.length > 0) && (
        <ul className="plan-today__list">
          {leftover.map((ev) => item(ev, true))}
          {todays.map((ev) => item(ev))}
        </ul>
      )}
    </section>
  );
}
