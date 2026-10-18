import { doneOnDay } from './entries';
import { weekdayOrder } from './weekStart';

/**
 * A goal's planned weekdays: a 3×-a-week run on Monday, Wednesday and
 * Friday. The days repeat every week, and when a goal has them its target is
 * how many there are (the backend sets one from the other).
 *
 * Stored as `goal.plannedDays`, a 7-bit mask in ISO order whatever day the
 * calendar starts on: bit 0 is Monday, bit 6 Sunday. Null or 0 is no planned
 * days, and any day of the week counts, as it always has.
 *
 * Days here are ISO weekday indexes, 0 for Monday to 6 for Sunday, the same
 * as a column of the week card (which always runs Monday to Sunday).
 */

export const ALL_DAYS = 0b111_1111;

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** The ISO weekday indexes a mask holds, Monday first: 0b10101 → [0, 2, 4]. */
export function maskToDays(mask) {
  const m = Number(mask) & ALL_DAYS;
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    if (m & (1 << i)) days.push(i);
  }
  return days;
}

/** A list of ISO weekday indexes as a mask; 0 for none. */
export function daysToMask(days) {
  return (days ?? []).reduce((m, d) => (Number.isInteger(d) && d >= 0 && d <= 6 ? m | (1 << d) : m), 0);
}

/** 0 for Monday to 6 for Sunday. */
export function isoWeekday(date) {
  return (date.getDay() + 6) % 7;
}

function asDate(date) {
  if (date instanceof Date) return date;
  const [y, m, d] = String(date).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** The goal's planned days, Monday first; empty when it has none. */
export function plannedDays(goal) {
  return goal?.plannedDays ? maskToDays(goal.plannedDays) : [];
}

export function hasPlannedDays(goal) {
  return plannedDays(goal).length > 0;
}

/** Whether `date` (a Date or "YYYY-MM-DD") is one of the goal's planned days. */
export function isPlannedOn(goal, date) {
  if (!goal?.plannedDays) return false;
  return (Number(goal.plannedDays) & (1 << isoWeekday(asDate(date)))) !== 0;
}

/** The ISO weekday indexes in the calendar's display order. */
export function isoDayOrder(weekStart = 'monday') {
  return weekdayOrder(weekStart).map((jsDay) => (jsDay + 6) % 7);
}

/**
 * "Mon, Wed, Fri", ordered as the calendar is set to start its week; "Every
 * day" for all seven; '' for a goal without planned days.
 */
export function plannedDaysLabel(goal, weekStart = 'monday') {
  const days = plannedDays(goal);
  if (days.length === 0) return '';
  if (days.length === 7) return 'Every day';
  const picked = new Set(days);
  return isoDayOrder(weekStart)
    .filter((d) => picked.has(d))
    .map((d) => DAY_SHORT[d])
    .join(', ');
}

/**
 * How many of the goal's planned days fall in this Monday-to-Sunday week up
 * to and including `date`: what is due by then. 0 for a goal without them.
 */
export function plannedDueBy(goal, date) {
  const upTo = isoWeekday(asDate(date));
  return plannedDays(goal).filter((d) => d <= upTo).length;
}

/** The same, from a week-card column (0 for Monday) rather than a date. */
export function plannedDueByIndex(goal, dayIndex) {
  const upTo = Math.min(6, Math.max(0, dayIndex));
  return plannedDays(goal).filter((d) => d <= upTo).length;
}

/**
 * The goals planned for `date` (a Date or "YYYY-MM-DD"), each with whether it
 * has a completed entry that day: what the calendar draws on a day. In the
 * order `goals` came in.
 */
export function plannedGoalsOn(goals, behaviors, date) {
  const d = asDate(date);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return (goals ?? [])
    .filter((goal) => isPlannedOn(goal, d))
    .map((goal) => ({ goal, done: doneOnDay(behaviors ?? [], goal.id, iso) }));
}
