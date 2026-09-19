import { addDays, parseIsoDate, startOfWeek, toIsoDate, weekSummary } from '../pages/dashboardData';

/**
 * Everything the week report draws, from raw goals, entries and planned
 * events. Pure: no React, no clock (`today` is passed in), so every number on
 * the page can be tested.
 *
 * It only derives what the records carry. Entries have dates, not times of
 * day (the server stores times without a zone), so nothing here pretends to
 * know when in the day something happened.
 */

export const MOODS = ['great', 'good', 'neutral', 'bad', 'terrible'];
const MOOD_SCORE = { great: 2, good: 1, neutral: 0, bad: -1, terrible: -2 };

/** Goals as the week saw them: the current list, plus any archived goal that
 * still had entries this week, so a goal archived on Friday keeps its week. */
function goalsForWeek(goals, entries) {
  const byId = new Map(goals.map((g) => [g.id, g]));
  for (const e of entries) {
    if (e.goal && !byId.has(e.goal.id)) byId.set(e.goal.id, e.goal);
  }
  return [...byId.values()];
}

function inWeek(iso, days) {
  return iso >= days[0] && iso <= days[6];
}

/** Seconds an event spends inside [from, to), for timed events only. */
function overlapSeconds(event, from, to) {
  if (event.allDay) return 0;
  const s = new Date(event.startsAt);
  const e = new Date(event.endsAt);
  const a = Math.max(s.getTime(), from.getTime());
  const b = Math.min(e.getTime(), to.getTime());
  return b > a ? Math.round((b - a) / 1000) : 0;
}

/**
 * @param goals     current goals (GET /api/goals)
 * @param behaviors entries covering at least this week and the one before
 * @param events    planned events overlapping this week
 * @param weekStart any date in the week; normalised to its Monday
 */
export function buildWeekReport({ goals, behaviors, events = [], weekStart, today }) {
  const monday = startOfWeek(weekStart);
  const days = Array.from({ length: 7 }, (_, i) => toIsoDate(addDays(monday, i)));
  const prevMonday = addDays(monday, -7);
  const prevDays = Array.from({ length: 7 }, (_, i) => toIsoDate(addDays(prevMonday, i)));

  const week = behaviors.filter((b) => inWeek(b.logDate, days));
  const prev = behaviors.filter((b) => inWeek(b.logDate, prevDays));
  const weekGoals = goalsForWeek(goals, week);

  const summary = weekSummary(weekGoals, behaviors, monday, today);
  const prevSummary = weekSummary(goalsForWeek(goals, prev), behaviors, prevMonday, today);
  const planned = summary.rows.reduce((s, r) => s + r.target, 0);
  const achieved = summary.rows.reduce((s, r) => s + Math.min(r.done, r.target), 0);

  // Per day: what was logged, how much of it was done, time tracked, mood.
  const perDay = days.map((iso, i) => {
    const list = week.filter((b) => b.logDate === iso);
    const scored = list.filter((b) => b.mood in MOOD_SCORE);
    return {
      iso,
      date: parseIsoDate(iso),
      total: list.length,
      completed: list.filter((b) => b.completed).length,
      notDone: list.filter((b) => !b.completed).length,
      seconds: list.reduce((s, b) => s + (b.durationSeconds ?? 0), 0),
      mood: scored.length ? scored.reduce((s, b) => s + MOOD_SCORE[b.mood], 0) / scored.length : null,
      prevTotal: prev.filter((b) => b.logDate === prevDays[i]).length,
      future: iso > toIsoDate(today),
    };
  });

  // Goal × day: how many entries each goal got each day, and whether any
  // of them was marked done.
  const matrix = summary.rows.map((row) => ({
    goal: row.goal,
    target: row.target,
    done: row.done,
    cells: days.map((iso, i) => {
      const list = week.filter((b) => b.goal?.id === row.goal.id && b.logDate === iso);
      return {
        iso,
        count: list.length,
        completed: list.some((b) => b.completed),
        status: row.statuses[i],
      };
    }),
  }));
  const loose = week.filter((b) => !b.goal);

  // Mood mix, in scale order.
  const moods = MOODS.map((m) => ({ mood: m, count: week.filter((b) => b.mood === m).length }));

  // Where the tracked time went: goal-less sessions by their own name, the
  // rest by the goal they were logged against.
  const timeBy = new Map();
  for (const b of week) {
    if (!b.durationSeconds) continue;
    const name = b.goal?.title ?? b.note ?? 'Untitled';
    timeBy.set(name, (timeBy.get(name) ?? 0) + b.durationSeconds);
  }
  const time = [...timeBy.entries()]
    .map(([name, seconds]) => ({ name, seconds }))
    .sort((a, b) => b.seconds - a.seconds);
  const trackedSeconds = time.reduce((s, t) => s + t.seconds, 0);

  const placeCounts = new Map();
  for (const b of week) {
    if (b.placeName) placeCounts.set(b.placeName, (placeCounts.get(b.placeName) ?? 0) + 1);
  }
  const places = [...placeCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // What was planned on the calendar for this week.
  const from = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
  const to = addDays(from, 7);
  const plannedSeconds = events.reduce((s, e) => s + overlapSeconds(e, from, to), 0);

  // Longest run of consecutive days with something done, inside the week.
  let run = 0;
  let longestRun = 0;
  for (const d of perDay) {
    run = d.completed > 0 ? run + 1 : 0;
    longestRun = Math.max(longestRun, run);
  }

  const busiest = perDay.reduce((best, d) => (d.total > (best?.total ?? 0) ? d : best), null);

  return {
    monday,
    days,
    planned,
    achieved,
    percent: planned ? Math.round((achieved / planned) * 100) : null,
    prevPercent: prevSummary.rows.length && prevSummary.rows.some((r) => r.target)
      ? prevSummary.percent
      : null,
    entries: week.length,
    prevEntries: prev.length,
    completedEntries: week.filter((b) => b.completed).length,
    activeDays: perDay.filter((d) => d.total > 0).length,
    longestRun,
    busiest: busiest && busiest.total > 0 ? busiest : null,
    perDay,
    matrix,
    looseEntries: loose.length,
    moods,
    moodTotal: moods.reduce((s, m) => s + m.count, 0),
    time,
    trackedSeconds,
    places,
    plan: {
      events: events.length,
      timedEvents: events.filter((e) => !e.allDay).length,
      plannedSeconds,
    },
    goalsOnTarget: summary.rows.filter((r) => r.done >= r.target).length,
    goalsTotal: summary.rows.length,
  };
}

/** "3h 20m", "45m", "0m". */
export function hoursMinutes(seconds) {
  const m = Math.round(seconds / 60);
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${rest}m`;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

/**
 * The headline, in words: what happened, against the target the person set,
 * and how that compares with the week before when there is one to compare.
 */
export function headline(r) {
  if (r.percent === null) {
    return r.entries
      ? `You logged ${r.entries} ${r.entries === 1 ? 'entry' : 'entries'} across ${r.activeDays} ${r.activeDays === 1 ? 'day' : 'days'}, with no weekly targets set.`
      : 'Nothing was logged this week.';
  }
  let text = `You hit ${r.achieved} of ${r.planned} planned days`;
  if (r.prevPercent !== null) {
    const d = r.percent - r.prevPercent;
    text += d === 0 ? ', level with last week' : `, ${Math.abs(d)} points ${d > 0 ? 'up on' : 'down from'} last week`;
  }
  return `${text}.`;
}
