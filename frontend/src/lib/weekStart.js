import { storedChoice } from './storedChoice';

/**
 * Which day the calendar's weeks start on: Sunday (the default) or Monday.
 *
 * Calendar views only: the planner's week and month, the month grid, the
 * dashboard's month dialog and the activity month. Weekly goal targets, the
 * week card, rings and reports still count Monday to Sunday (startOfWeek in
 * pages/dashboardData), so a target never changes meaning with a display
 * preference.
 *
 * Kept per browser, like the theme and the modules.
 */

export const WEEK_STARTS = ['sunday', 'monday'];

const choice = storedChoice({ key: 'mordi-week-start', values: WEEK_STARTS, fallback: 'sunday' });

/** 'monday' or 'sunday', and re-renders when it changes. */
export const useWeekStart = choice.useChoice;
export const getWeekStart = choice.get;
export const setWeekStart = choice.set;

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
