/**
 * Calendar maths. No React, no clock: everything takes dates as arguments.
 *
 * Events use local wall-clock times, sent to and from the API as
 * "YYYY-MM-DDTHH:mm:ss" with no zone, the same way entries use a local date.
 * Every event is a half-open range [startsAt, endsAt).
 */

export const HOUR_PX = 48;
export const SNAP_MINUTES = 15;
export const DAY_MINUTES = 24 * 60;

/** The calendar palette. Names are stored; each theme decides the colour. */
export const COLORS = ['accent', 'sky', 'sage', 'amber', 'rose', 'violet', 'slate'];

const pad = (n) => String(n).padStart(2, '0');

export function toLocalIso(date) {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  );
}

/** "2026-09-18T09:30:00" read as local time, not UTC. */
export function parseLocal(value) {
  const [d, t = '00:00:00'] = String(value).split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [h, min] = t.split(':').map(Number);
  return new Date(y, m - 1, day, h || 0, min || 0, 0, 0);
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n, date.getHours(), date.getMinutes());
}

export function addMinutes(date, n) {
  return new Date(date.getTime() + n * 60_000);
}

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Monday of the week containing `date`, matching every other week in the app. */
export function startOfWeek(date) {
  const d = startOfDay(date);
  return addDays(d, -((d.getDay() + 6) % 7));
}

export function daysFrom(start, count) {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

export function isoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Minutes since midnight, snapped to the grid and kept inside the day. */
export function snapMinutes(minutes, step = SNAP_MINUTES) {
  return Math.min(DAY_MINUTES, Math.max(0, Math.round(minutes / step) * step));
}

export function minutesInto(date, day) {
  return Math.round((date.getTime() - startOfDay(day).getTime()) / 60_000);
}

export function atMinutes(day, minutes) {
  return addMinutes(startOfDay(day), minutes);
}

/** Does the event touch this day at all? */
export function onDay(event, day) {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  return parseLocal(event.startsAt) < dayEnd && parseLocal(event.endsAt) > dayStart;
}

/**
 * Timed events on one day, laid out Google Calendar style: each is clipped to
 * the day, and events that overlap share the width in side-by-side columns.
 *
 * Overlapping events form a cluster; within it, each event takes the first
 * column free at its start. Every event in a cluster reports the cluster's
 * column count, so they all divide the width the same way.
 */
export function layoutDay(events, day) {
  const items = events
    .filter((e) => !e.allDay && onDay(e, day))
    .map((event) => {
      const top = Math.max(0, minutesInto(parseLocal(event.startsAt), day));
      const bottom = Math.min(DAY_MINUTES, minutesInto(parseLocal(event.endsAt), day));
      return { event, top, bottom: Math.max(bottom, top + SNAP_MINUTES) };
    })
    .sort((a, b) => a.top - b.top || b.bottom - a.bottom);

  const placed = [];
  let cluster = [];
  let clusterEnd = -1;
  let columnsEnd = [];

  const close = () => {
    const count = columnsEnd.length;
    cluster.forEach((item) => placed.push({ ...item, columns: count }));
    cluster = [];
    columnsEnd = [];
  };

  for (const item of items) {
    if (item.top >= clusterEnd) {
      close();
      clusterEnd = -1;
    }
    let column = columnsEnd.findIndex((end) => end <= item.top);
    if (column === -1) {
      column = columnsEnd.length;
      columnsEnd.push(item.bottom);
    } else {
      columnsEnd[column] = item.bottom;
    }
    cluster.push({ ...item, column });
    clusterEnd = Math.max(clusterEnd, item.bottom);
  }
  close();
  return placed;
}

/** All-day events touching this day. */
export function allDayOn(events, day) {
  return events.filter((e) => e.allDay && onDay(e, day));
}

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

/** "9:00 AM – 10:30 AM", in the browser's own clock convention. */
export function formatRange(event) {
  if (event.allDay) return 'All day';
  return `${timeFormat.format(parseLocal(event.startsAt))} – ${timeFormat.format(parseLocal(event.endsAt))}`;
}

export function formatTime(date) {
  return timeFormat.format(date);
}

const hourOnly = new Intl.DateTimeFormat(undefined, { hour: 'numeric' });

/** "10 AM", or "9:30 AM" when the minutes matter: the start, compactly. */
export function shortTime(date) {
  return date.getMinutes() === 0 ? hourOnly.format(date) : timeFormat.format(date);
}

/**
 * The range as a calendar block has room for it: "2 – 3 PM",
 * "9:30 – 11:30 AM". The locale decides what the two ends share.
 */
export function compactRange(event) {
  if (event.allDay) return 'All day';
  const start = parseLocal(event.startsAt);
  const end = parseLocal(event.endsAt);
  const fmt = start.getMinutes() === 0 && end.getMinutes() === 0 ? hourOnly : timeFormat;
  return fmt.formatRange ? fmt.formatRange(start, end) : formatRange(event);
}

/** The goal an event most likely counts toward, by title. */
export function matchGoal(event, goals) {
  const title = event.title.trim().toLowerCase();
  return (
    goals.find((g) => g.title.trim().toLowerCase() === title) ??
    goals.find((g) => {
      const t = g.title.trim().toLowerCase();
      return t.length > 2 && (title.includes(t) || t.includes(title));
    }) ??
    null
  );
}
