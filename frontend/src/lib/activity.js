import { addDays, parseIsoDate, startOfWeek, toIsoDate } from '../pages/dashboardData';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Five steps, like the contribution graph it is modelled on: none, then four. */
export const LEVELS = 4;

/**
 * Below this many logs in a day, a count maps straight to a level: one log is
 * the lightest step, four or more the darkest. Only someone who logs more than
 * this in a day stretches the scale, and then every day is measured against
 * their own busiest one.
 *
 * Pure relative scaling was the obvious alternative and read wrong: a new
 * account whose busiest day has one log painted every logged day at full
 * strength, which looks like a heavy history.
 */
export const SCALE_FLOOR = 4;

/** Logs per calendar day, keyed by YYYY-MM-DD. */
export function countByDay(behaviors) {
  const counts = new Map();
  for (const entry of behaviors) {
    if (!entry?.logDate) continue;
    const iso = entry.logDate.slice(0, 10);
    counts.set(iso, (counts.get(iso) ?? 0) + 1);
  }
  return counts;
}

/** 0 for nothing logged; otherwise 1..LEVELS, never 0 for a day with a log. */
export function levelFor(count, scale) {
  if (!count || count <= 0) return 0;
  return Math.min(LEVELS, Math.max(1, Math.ceil((count / scale) * LEVELS)));
}

/**
 * The grid: `weeks` columns ending with the week that contains `today`, each
 * a Monday-to-Sunday column. Days after today are marked `future` and carry no
 * count, so the last column does not show empty days as missed.
 */
export function buildHeatmap(counts, today, weeks = 53) {
  const todayIso = toIsoDate(today);
  const first = addDays(startOfWeek(today), -7 * (weeks - 1));

  let max = 0;
  let total = 0;
  let activeDays = 0;
  let busiest = null;

  const columns = [];
  for (let w = 0; w < weeks; w += 1) {
    const days = [];
    for (let d = 0; d < 7; d += 1) {
      const date = addDays(first, w * 7 + d);
      const iso = toIsoDate(date);
      const future = iso > todayIso;
      const count = future ? 0 : (counts.get(iso) ?? 0);
      if (count > 0) {
        total += count;
        activeDays += 1;
        if (count > max) {
          max = count;
          busiest = { iso, count };
        }
      }
      days.push({ iso, count, future });
    }
    columns.push(days);
  }

  const scale = Math.max(max, SCALE_FLOOR);
  for (const days of columns) {
    for (const day of days) day.level = day.future ? 0 : levelFor(day.count, scale);
  }

  // A month label over the first column whose Monday falls in a new month,
  // skipped when it would crowd the previous one.
  const months = [];
  let lastMonth = -1;
  let lastCol = -Infinity;
  columns.forEach((days, col) => {
    const month = parseIsoDate(days[0].iso).getMonth();
    if (month !== lastMonth) {
      if (col - lastCol >= 3) {
        months.push({ col, label: MONTHS[month] });
        lastCol = col;
      }
      lastMonth = month;
    }
  });

  return { columns, months, total, activeDays, busiest, scale };
}

/** "3 logs on Wed, Sep 16" */
export function describeDay({ iso, count }) {
  const date = parseIsoDate(iso);
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
  const noun = count === 1 ? 'log' : 'logs';
  const what = count === 0 ? 'No logs' : `${count} ${noun}`;
  return `${what} on ${weekday}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}
