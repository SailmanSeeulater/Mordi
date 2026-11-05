import client from '../api/client';
import { storedChoice } from './storedChoice';

/**
 * Which day the week starts on: Monday (the default) or Sunday.
 *
 * It is the week everywhere, not only how a calendar is laid out: weekly
 * targets, the week card and rings, pace, reports, shared goals and the
 * reminder all count from it (startOfWeek in pages/dashboardData), and so do
 * the planner, the month grids and the activity views. The server keeps it
 * on the account, because it counts reports and reminders with it too.
 *
 * Read from this browser's copy, so a page draws at once; syncWeekStart
 * brings that copy into line with the account after sign-in.
 */

export const WEEK_STARTS = ['sunday', 'monday'];

const choice = storedChoice({ key: 'mordi-week-start', values: WEEK_STARTS, fallback: 'monday' });

/** 'monday' or 'sunday', and re-renders when it changes. */
export const useWeekStart = choice.useChoice;
export const getWeekStart = choice.get;

/**
 * Set once this browser's copy has been matched with the account. Before the
 * account kept a week start, a choice lived only here, so the first sync
 * sends that choice up instead of overwriting it with the account's default.
 */
const SYNCED_KEY = 'mordi-week-start-synced';

function synced() {
  try {
    return localStorage.getItem(SYNCED_KEY) === '1';
  } catch {
    return false;
  }
}

function markSynced() {
  try {
    localStorage.setItem(SYNCED_KEY, '1');
  } catch {
    // Blocked storage: the next sync just checks again.
  }
}

function saveToAccount(value) {
  return Promise.resolve().then(() => client.put('/api/account/preferences', { weekStart: value }));
}

/**
 * Changes the week start here at once and saves it to the account. If the
 * save fails, the next sync puts the account's choice back.
 */
export function setWeekStart(value) {
  if (!WEEK_STARTS.includes(value)) return;
  choice.set(value);
  markSynced();
  saveToAccount(value).catch(() => {});
}

/**
 * Brings this browser's week start into line with the account: once, by
 * sending up a choice made here before the account kept one; after that, by
 * taking the account's, so a change made on another device arrives here.
 */
export async function syncWeekStart() {
  try {
    const local = choice.saved();
    if (!synced() && local) {
      await saveToAccount(local);
      markSynced();
      return;
    }
    const res = await client.get('/api/account/preferences');
    const saved = res?.data?.weekStart;
    if (WEEK_STARTS.includes(saved)) {
      if (saved !== choice.get()) choice.set(saved);
      markSynced();
    }
  } catch {
    // Offline or signed out: keep what this browser has.
  }
}

/** The JavaScript weekday (0 is Sunday) a calendar week opens on. */
export function firstWeekday(weekStart) {
  return weekStart === 'sunday' ? 0 : 1;
}

/**
 * The first day of the calendar week containing `date`, at local midnight.
 * Built from the local year, month and day rather than by subtracting
 * milliseconds, so a daylight-saving change inside the week cannot land it
 * an hour off, on the wrong day.
 */
export function startOfCalendarWeek(date, weekStart = 'monday') {
  const offset = (date.getDay() - firstWeekday(weekStart) + 7) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset);
}

/** The seven JavaScript weekdays in calendar order: [1..6, 0] or [0..6]. */
export function weekdayOrder(weekStart = 'monday') {
  const first = firstWeekday(weekStart);
  return Array.from({ length: 7 }, (_, i) => (first + i) % 7);
}

const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Mon" … "Sun", or "Sun" … "Sat", for a calendar's header row. */
export function weekdayLabels(weekStart = 'monday') {
  return weekdayOrder(weekStart).map((d) => SHORT[d]);
}
