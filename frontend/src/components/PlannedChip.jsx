import { goalIcon } from '../lib/categories';

/**
 * A goal planned for this weekday, at the top of the day's column: filled
 * once it is done that day, outlined until then. On today or an earlier day
 * it opens the log form for that goal and day; a day still to come only
 * shows the plan, since nothing can be logged for it yet.
 */
export default function PlannedChip({ goal, done, iso, todayIso, dayName, onLog }) {
  const className = 'planner__goal' + (done ? ' planner__goal--done' : '');
  const state = done ? 'done' : iso < todayIso ? 'not done' : iso === todayIso ? 'not done yet' : 'still to come';
  const body = (
    <>
      <span className="planner__goal-icon" aria-hidden="true">
        {goalIcon(goal)}
      </span>
      <span className="planner__goal-title" aria-hidden="true">
        {goal.title}
      </span>
    </>
  );
  if (iso > todayIso) {
    return (
      <span className={className + ' planner__goal--ahead'} title={goal.title}>
        {body}
        <span className="app-sr">{goal.title + ', planned, ' + state}</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      className={className}
      title={goal.title}
      aria-label={goal.title + ', planned, ' + state + '. Log it for ' + dayName + '.'}
      onClick={onLog}
    >
      {body}
    </button>
  );
}
