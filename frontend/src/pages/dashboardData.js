// Pure date/grid helpers for the dashboard. Dates are handled as local-time
// calendar days and compared as YYYY-MM-DD strings, matching the backend's LocalDate.

import { startOfCalendarWeek } from '../lib/weekStart';
import { hasPlannedDays, isPlannedOn, plannedDueByIndex } from '../lib/plannedDays';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function toIsoDate(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export function parseIsoDate(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

/** Monday of the week. Weekly targets always count Monday to Sunday,
 * whichever day the calendar is set to start on. */
export function startOfWeek(date) {
  const daysSinceMonday = (date.getDay() + 6) % 7;
  return addDays(date, -daysSinceMonday);
}

export function weekDays(weekStart) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function formatWeekRange(weekStart) {
  const end = addDays(weekStart, 6);
  const startLabel = `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}`;
  const endLabel = end.getMonth() === weekStart.getMonth()
    ? `${end.getDate()}`
    : `${MONTHS[end.getMonth()]} ${end.getDate()}`;
  return `${startLabel} – ${endLabel}`;
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

export function formatMonth(date) {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Six weeks covering the month, so the grid never changes height as you page
 * through, led by Monday or Sunday as the calendar is set (lib/weekStart).
 * Days outside the month are marked `outside`.
 */
export function monthGrid(date, weekStart = 'monday') {
  const first = startOfMonth(date);
  const gridStart = startOfCalendarWeek(first, weekStart);
  const month = first.getMonth();
  return Array.from({ length: 42 }, (_, i) => {
    const day = addDays(gridStart, i);
    return { date: day, iso: toIsoDate(day), outside: day.getMonth() !== month };
  });
}

export function goalTarget(goal) {
  if (Number.isInteger(goal.targetPerWeek) && goal.targetPerWeek >= 1) {
    return Math.min(goal.targetPerWeek, 7);
  }
  // Goals from a backend without targetPerWeek yet.
  return goal.frequency === 'daily' ? 7 : 1;
}

export function targetLabel(goal) {
  const target = goalTarget(goal);
  return target === 7 ? 'daily' : `${target}× weekly`;
}

/**
 * One goal on one day: 'done', 'missed' or 'empty'. An empty past day reads
 * as missed only when the person said the goal was due that day: a daily
 * goal, or one planned for that weekday. Any other empty day is a rest day.
 */
export function dayStatus(goal, dayBehaviors, dayIso, todayIso) {
  if (dayIso > todayIso) return 'empty';
  if (dayBehaviors.some((b) => b.completed)) return 'done';
  if (dayBehaviors.length > 0) return 'missed';
  const createdIso = goal.createdAt ? goal.createdAt.slice(0, 10) : null;
  const due = hasPlannedDays(goal) ? isPlannedOn(goal, dayIso) : goalTarget(goal) === 7;
  if (dayIso < todayIso && due && (!createdIso || dayIso >= createdIso)) {
    return 'missed';
  }
  return 'empty';
}

export function buildSegments(statuses) {
  const segments = [];
  statuses.forEach((status, i) => {
    if (status === 'empty') return;
    const last = segments[segments.length - 1];
    if (last && last.status === status && last.start + last.length === i) {
      last.length += 1;
    } else {
      segments.push({ start: i, length: 1, status });
    }
  });
  return segments;
}

function behaviorsByGoalAndDay(behaviors) {
  const index = new Map();
  behaviors.forEach((b) => {
    if (!b.goal) return;
    const key = `${b.goal.id}|${b.logDate}`;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(b);
  });
  return index;
}

export function weekSummary(goals, behaviors, weekStart, today) {
  const todayIso = toIsoDate(today);
  const days = weekDays(weekStart).map(toIsoDate);
  const index = behaviorsByGoalAndDay(behaviors);

  const rows = goals.map((goal) => {
    const statuses = days.map((day) =>
      dayStatus(goal, index.get(`${goal.id}|${day}`) ?? [], day, todayIso),
    );
    return {
      goal,
      statuses,
      segments: buildSegments(statuses),
      done: statuses.filter((s) => s === 'done').length,
      missed: statuses.filter((s) => s === 'missed').length,
      target: goalTarget(goal),
    };
  });

  const planned = rows.reduce((sum, r) => sum + r.target, 0);
  const achieved = rows.reduce((sum, r) => sum + Math.min(r.done, r.target), 0);

  const weekEntries = behaviors.filter((b) => b.logDate >= days[0] && b.logDate <= days[6]);
  const moodCounts = new Map();
  weekEntries.forEach((b) => {
    if (b.mood) moodCounts.set(b.mood, (moodCounts.get(b.mood) ?? 0) + 1);
  });
  let topMood = null;
  moodCounts.forEach((count, mood) => {
    if (!topMood || count > moodCounts.get(topMood)) topMood = mood;
  });

  return {
    days,
    rows,
    percent: planned ? Math.round((achieved / planned) * 100) : 0,
    missed: rows.reduce((sum, r) => sum + r.missed, 0),
    entries: weekEntries.length,
    topMood,
  };
}

export function currentStreak(behaviors, today) {
  const doneDays = new Set(behaviors.filter((b) => b.completed).map((b) => b.logDate));
  let cursor = doneDays.has(toIsoDate(today)) ? today : addDays(today, -1);
  let streak = 0;
  while (doneDays.has(toIsoDate(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function recentEntries(behaviors, count) {
  return [...behaviors]
    .sort((a, b) =>
      a.logDate === b.logDate
        ? (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
        : b.logDate.localeCompare(a.logDate),
    )
    .slice(0, count);
}

/**
 * What is due by the end of the day in column `todayIndex` (0 for Monday),
 * summed over the week summary's rows and rounded once. A goal with planned
 * days owes the planned days so far; any other goal's target is spread
 * evenly over the seven days. With no planned days anywhere this is exactly
 * the even spread of the whole week's target.
 */
export function expectedBy(rows, todayIndex) {
  const dayIndex = Math.min(6, Math.max(0, todayIndex));
  const total = rows.reduce(
    (sum, r) =>
      sum + (hasPlannedDays(r.goal) ? plannedDueByIndex(r.goal, dayIndex) : (r.target * (dayIndex + 1)) / 7),
    0,
  );
  return Math.round(total);
}

/**
 * How the week stands against its own target, as of today. "expected" is
 * what is due by the end of today, and "delta" is how far ahead (+) or
 * behind (-) the count is. Sunday night, expected is the whole target.
 *
 * Given the week summary's `rows`, a goal planned for particular days counts
 * those days (see expectedBy). Without them, or for goals without planned
 * days, the target is spread evenly over the seven days.
 */
export function weekPace(planned, achieved, todayIndex, rows) {
  if (!planned) return { expected: 0, delta: 0, state: 'none' };
  const dayIndex = Math.min(6, Math.max(0, todayIndex));
  const expected = Array.isArray(rows)
    ? expectedBy(rows, dayIndex)
    : Math.round((planned * (dayIndex + 1)) / 7);
  const delta = achieved - expected;
  if (achieved >= planned) return { expected, delta, state: 'done' };
  if (delta > 0) return { expected, delta, state: 'ahead' };
  if (delta < 0) return { expected, delta, state: 'behind' };
  return { expected, delta, state: 'on' };
}

/** "Week done", "On pace", "Ahead by 2", "Log 3 to be on pace". A shortfall
 * is phrased as the next step, not the deficit. */
export function paceLabel(pace) {
  switch (pace.state) {
    case 'done':
      return 'Week done';
    case 'ahead':
      return `Ahead by ${pace.delta}`;
    case 'behind':
      return `Log ${-pace.delta} to be on pace`;
    case 'on':
      return 'On pace';
    default:
      return 'No targets set';
  }
}

/** Entries logged on each of the seven days, Monday first. */
export function entriesPerDay(behaviors, days) {
  return days.map((iso) => behaviors.filter((b) => b.logDate === iso).length);
}

/** The index of the busiest day so far, or null when nothing was logged. */
export function bestDay(counts) {
  let best = null;
  counts.forEach((n, i) => {
    if (n > 0 && (best === null || n > counts[best])) best = i;
  });
  return best;
}
