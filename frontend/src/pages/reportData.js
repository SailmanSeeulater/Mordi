import { parseIsoDate } from './dashboardData';

/**
 * A report row as the page needs it, from a report row as the API returns it.
 *
 * Rows written before the report rework have no planned/achieved counts and
 * their completionRate means completed-of-logged rather than achieved-of-
 * planned. Rather than quietly mixing the two numbers on one page, a legacy
 * row is marked as such and the page says which question it answers.
 */
export function normaliseReport(report) {
  const planned = report.plannedEntries;
  const achieved = report.achievedEntries;
  const legacy = planned == null || achieved == null;

  const logged = report.totalBehaviors ?? 0;
  const completed = report.completedBehaviors ?? 0;

  const percent = legacy
    ? logged > 0
      ? Math.round((completed / logged) * 100)
      : 0
    : planned > 0
      ? Math.round((achieved / planned) * 100)
      : 0;

  return {
    id: report.id,
    weekStart: report.weekStart,
    weekEnd: report.weekEnd,
    legacy,
    percent,
    planned: legacy ? logged : planned,
    achieved: legacy ? completed : achieved,
    goalsTotal: report.goalsTotal ?? null,
    goalsOnTrack: report.goalsOnTrack ?? null,
    logged,
    mood: report.mostCommonMood || null,
    summary: report.summary || '',
  };
}

const weekFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

/** "14 – 20 Sep" style label for a report's own stored week. */
export function reportWeekLabel(report) {
  if (!report.weekStart || !report.weekEnd) return '';
  return `${weekFormat.format(parseIsoDate(report.weekStart))} – ${weekFormat.format(
    parseIsoDate(report.weekEnd),
  )}`;
}

/**
 * Newest first, and only one row per week — a server that still holds
 * duplicates from before the unique constraint should not render two cards for
 * the same seven days.
 */
export function sortReports(reports) {
  const byWeek = new Map();
  for (const report of reports) {
    const existing = byWeek.get(report.weekStart);
    if (!existing || (report.id ?? 0) > (existing.id ?? 0)) {
      byWeek.set(report.weekStart, report);
    }
  }
  return [...byWeek.values()].sort((a, b) => String(b.weekStart).localeCompare(a.weekStart));
}

/**
 * The change in completion against the week before it, for each report.
 * Returns a map of report id to a signed percentage, or null where there is no
 * adjacent earlier week to compare with.
 */
export function weekOnWeekDelta(reports) {
  const delta = new Map();
  reports.forEach((report, i) => {
    const earlier = reports[i + 1];
    if (!earlier || report.legacy || earlier.legacy) {
      delta.set(report.id, null);
      return;
    }
    delta.set(report.id, report.percent - earlier.percent);
  });
  return delta;
}
