import { addDays, goalTarget, startOfWeek, toIsoDate } from '../pages/dashboardData';

/**
 * A suggested weekly target, from what actually happened.
 *
 * Looks at the last `weeks` complete weeks (never the one in progress), and
 * counts, for each, the days with a completed entry for the goal. The average
 * decides:
 *
 *   - clearly above target (by a day or more): raise it to the average,
 *   - clearly below (by a day and a half or more): lower it,
 *   - nothing at all in those weeks: say so, and offer archiving instead,
 *   - otherwise: say nothing. A target close to reality is doing its job.
 *
 * A goal younger than the window gets no suggestion: two weeks of a new habit
 * is not a pattern. Suggestions are only ever offered, never applied.
 */
export function suggestTarget(goal, behaviors, today, weeks = 4) {
  const target = goalTarget(goal);
  const thisMonday = startOfWeek(today);
  const windowStart = addDays(thisMonday, -7 * weeks);
  if (goal.createdAt && new Date(goal.createdAt) > windowStart) return null;

  const doneDays = new Set(
    behaviors.filter((b) => b.completed && b.goal?.id === goal.id).map((b) => b.logDate),
  );
  const counts = [];
  for (let k = 1; k <= weeks; k += 1) {
    const monday = addDays(thisMonday, -7 * k);
    let n = 0;
    for (let d = 0; d < 7; d += 1) {
      if (doneDays.has(toIsoDate(addDays(monday, d)))) n += 1;
    }
    counts.push(n);
  }
  const average = counts.reduce((s, n) => s + n, 0) / weeks;
  const rounded = Math.min(7, Math.max(1, Math.round(average)));

  if (average === 0) return { kind: 'idle', weeks, average, target };
  if (average >= target + 1 && rounded > target) return { kind: 'raise', to: rounded, weeks, average, target };
  if (average <= target - 1.5 && rounded < target) return { kind: 'lower', to: rounded, weeks, average, target };
  return null;
}

/** "2.4" for an average, without a trailing ".0". */
export function formatAverage(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
