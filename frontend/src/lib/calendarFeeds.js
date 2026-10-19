/**
 * Connected Google Calendars, without React: when one is due a refresh, how
 * its state reads, and what of it goes into a data export.
 *
 * The server refreshes every feed whose owner has used Mordi lately every
 * fifteen minutes. Opening the calendar catches up any feed it has not
 * reached, so someone back after a month away sees today's events, not last
 * month's.
 */

export const REFRESH_MS = 15 * 60_000;

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

/** Never synced, or not for fifteen minutes. A failed sync counts as stale too. */
export function isStale(feed, now = new Date()) {
  if (!feed?.lastSyncedAt) return true;
  const at = new Date(feed.lastSyncedAt).getTime();
  return Number.isNaN(at) || now.getTime() - at >= REFRESH_MS;
}

/** "just now", "4 min ago", "2 hr ago", or a date. */
export function ago(iso, now = new Date()) {
  const at = new Date(iso);
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (Number.isNaN(minutes)) return '';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `on ${dateFormat.format(at)}`;
}

/** "Synced 4 min ago · 128 events", or "Not synced yet". */
export function syncedLabel(feed, now = new Date()) {
  if (!feed?.lastSyncedAt) return 'Not synced yet';
  const n = feed.eventCount ?? 0;
  return `Synced ${ago(feed.lastSyncedAt, now)} · ${n} event${n === 1 ? '' : 's'}`;
}
