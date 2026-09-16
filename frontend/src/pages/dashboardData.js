// Pure date/grid helpers for the dashboard. Dates are handled as local-time
// calendar days and compared as YYYY-MM-DD strings, matching the backend's LocalDate.

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
 * Six Monday-led weeks covering the month, so the grid never changes height
 * as you page through. Days outside the month are marked `outside`.
 */
export function monthGrid(date) {
  const first = startOfMonth(date);
  const gridStart = startOfWeek(first);
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

export function dayStatus(goal, dayBehaviors, dayIso, todayIso) {
  if (dayIso > todayIso) return 'empty';
  if (dayBehaviors.some((b) => b.completed)) return 'done';
  if (dayBehaviors.length > 0) return 'missed';
  const createdIso = goal.createdAt ? goal.createdAt.slice(0, 10) : null;
  if (dayIso < todayIso && goalTarget(goal) === 7 && (!createdIso || dayIso >= createdIso)) {
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
