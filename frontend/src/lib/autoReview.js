import client from '../api/client';
import { addDays, startOfWeek, toIsoDate } from '../pages/dashboardData';

/**
 * The week before this one, written up without anyone asking.
 *
 * A report is a snapshot of a finished week. There was never a reason for a
 * person to press a button to take it: the first time Mordi is opened after a
 * week ends, it writes that week up, if anything was logged in it.
 *
 * Resolves to the report row for last week, or null when there is nothing to
 * review or the request failed. Only ever writes last week, never the week in
 * progress, so a report is never frozen half way through.
 */
export async function ensureLastWeekReport(today, loggedLastWeek) {
  const lastMonday = toIsoDate(addDays(startOfWeek(today), -7));
  try {
    const res = await client.get('/api/reports');
    const rows = Array.isArray(res.data) ? res.data : [];
    const existing = rows
      .filter((r) => r.weekStart === lastMonday)
      .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];
    if (existing) return existing;
    if (!loggedLastWeek) return null;
    const made = await client.post('/api/reports/generate', null, { params: { week: lastMonday } });
    return made.data ?? null;
  } catch {
    return null;
  }
}

export function lastWeekStart(today) {
  return toIsoDate(addDays(startOfWeek(today), -7));
}
