/**
 * Reading iCalendar (.ics, RFC 5545) files: what Google Calendar, Apple
 * Calendar and Outlook all export. No dependencies, no clock: `now` is passed
 * in, so the tests pin it.
 *
 * Produces events in the calendar's own shape, local wall-clock times:
 *   { title, startsAt, endsAt, allDay, placeName, notes, uid, recurring }
 *
 * Handled: folded lines, escaped text, all-day (VALUE=DATE) events, UTC times
 * (…Z), times in a named zone (TZID=…, converted with the browser's own time
 * zone data), floating times, DURATION instead of DTEND, and repeating events
 * (RRULE with DAILY / WEEKLY / MONTHLY / YEARLY, INTERVAL, COUNT, UNTIL, BYDAY
 * for weekly rules) with EXDATE exceptions. Repeats are expanded only inside
 * a window around now, so an event that "repeats forever" imports as the
 * occurrences that matter rather than as an endless list.
 */

const pad = (n) => String(n).padStart(2, '0');

export function toLocalIso(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

/** Unfolds continuation lines (a line starting with a space or tab). */
function unfold(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '');
}

function unescapeText(value) {
  return value.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

/** "DTSTART;TZID=Europe/Paris:20260918T090000" → { name, params, value } */
function parseLine(line) {
  const colon = line.search(/:(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  if (colon === -1) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...rawParams] = head.split(';');
  const params = {};
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value };
}

/** Milliseconds by which `zone` is ahead of UTC at the instant `utcMs`. */
function zoneOffset(utcMs, zone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date(utcMs));
    const get = (t) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return asUtc - utcMs;
  } catch {
    return null; // an unknown zone name: treat the time as floating
  }
}

/**
 * A DTSTART/DTEND/EXDATE value as a local Date, plus whether it is a date
 * without a time (an all-day value).
 */
export function parseDateValue(value, params = {}) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (params.VALUE === 'DATE' || h === undefined) {
    return { date: new Date(+y, +mo - 1, +d), allDay: true };
  }
  if (z) {
    return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0))), allDay: false };
  }
  if (params.TZID) {
    // Wall time in that zone → the instant → this browser's local time. Two
    // passes settle the offset across a daylight-saving change.
    const naive = Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0));
    let off = zoneOffset(naive, params.TZID);
    if (off !== null) {
      off = zoneOffset(naive - off, params.TZID) ?? off;
      return { date: new Date(naive - off), allDay: false };
    }
  }
  return { date: new Date(+y, +mo - 1, +d, +h, +mi, +(s ?? 0)), allDay: false };
}

/** "PT1H30M", "P1D" → milliseconds. */
function parseDuration(value) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, sign, w, d, h, mi, s] = m;
  const ms = (((+(w ?? 0) * 7 + +(d ?? 0)) * 24 + +(h ?? 0)) * 60 + +(mi ?? 0)) * 60_000 + +(s ?? 0) * 1000;
  return sign === '-' ? -ms : ms;
}

const DAYS = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 0 };

function parseRule(value) {
  const rule = {};
  for (const part of value.split(';')) {
    const [k, v] = part.split('=');
    if (k && v) rule[k.toUpperCase()] = v;
  }
  return rule;
}

const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds());
const sameMinute = (a, b) => Math.abs(a.getTime() - b.getTime()) < 60_000;

/**
 * Start times of a repeating event inside [from, to], newest rule features
 * aside. Weekly rules honour BYDAY; the others repeat on the start's own day.
 */
function occurrences(start, rule, from, to, limit) {
  const freq = rule.FREQ;
  const interval = Math.max(1, Number(rule.INTERVAL) || 1);
  const count = rule.COUNT ? Number(rule.COUNT) : Infinity;
  const until = rule.UNTIL ? parseDateValue(rule.UNTIL)?.date : null;
  const out = [];
  let made = 0;
  const accept = (d) => {
    made += 1;
    if (made > count) return false;
    if (until && d > until) return false;
    if (d >= from && d <= to) out.push(d);
    return out.length < limit && d <= to;
  };

  if (freq === 'WEEKLY') {
    const days = rule.BYDAY
      ? rule.BYDAY.split(',').map((x) => DAYS[x.slice(-2)]).filter((x) => x !== undefined).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
      : [start.getDay()];
    const weekStart = addDays(start, -((start.getDay() + 6) % 7));
    for (let week = 0; week < 5200; week += interval) {
      const base = addDays(weekStart, week * 7);
      for (const day of days) {
        const d = addDays(base, (day + 6) % 7);
        if (d < start) continue;
        if (!accept(d)) return out;
      }
    }
    return out;
  }

  for (let i = 0; i < 20000; i += 1) {
    let d;
    if (freq === 'DAILY') d = addDays(start, i * interval);
    else if (freq === 'MONTHLY') {
      d = new Date(start.getFullYear(), start.getMonth() + i * interval, start.getDate(), start.getHours(), start.getMinutes());
      if (d.getDate() !== start.getDate()) continue; // the 31st in a 30-day month
    } else if (freq === 'YEARLY') {
      d = new Date(start.getFullYear() + i * interval, start.getMonth(), start.getDate(), start.getHours(), start.getMinutes());
    } else {
      return [start];
    }
    if (!accept(d)) return out;
  }
  return out;
}

/**
 * All events in an .ics file, expanded and ready to import.
 * Returns { events, calendarName, skipped } where skipped counts entries that
 * were unusable (no start, cancelled, or longer than the calendar allows).
 */
export function parseIcs(text, { now = new Date(), pastDays = 30, futureDays = 365, limit = 500 } = {}) {
  const lines = unfold(text).split('\n');
  const from = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), -pastDays);
  const to = addDays(from, pastDays + futureDays);
  const events = [];
  let calendarName = null;
  let skipped = 0;
  let current = null;

  for (const raw of lines) {
    const line = parseLine(raw);
    if (!line) continue;
    if (line.name === 'X-WR-CALNAME' && !current) calendarName = unescapeText(line.value);
    if (line.name === 'BEGIN' && line.value.toUpperCase() === 'VEVENT') {
      current = { exdates: [] };
      continue;
    }
    if (!current) continue;
    if (line.name === 'END' && line.value.toUpperCase() === 'VEVENT') {
      const ev = current;
      current = null;
      if (!ev.start || ev.status === 'CANCELLED') {
        skipped += 1;
        continue;
      }
      let length;
      if (ev.end) length = ev.end.date - ev.start.date;
      else if (ev.duration != null) length = ev.duration;
      else length = ev.start.allDay ? 86_400_000 : 3_600_000;
      if (length <= 0) length = ev.start.allDay ? 86_400_000 : 3_600_000;
      if (length > 31 * 86_400_000) {
        skipped += 1;
        continue;
      }
      const starts = ev.rule
        ? occurrences(ev.start.date, ev.rule, from, to, limit).filter((d) => !ev.exdates.some((x) => sameMinute(x, d)))
        : [ev.start.date].filter((d) => d.getTime() + length >= from.getTime() && d <= to);
      for (const s of starts) {
        if (events.length >= limit) break;
        const e = new Date(s.getTime() + length);
        events.push({
          title: (ev.summary || 'Untitled event').slice(0, 120),
          startsAt: toLocalIso(s),
          endsAt: toLocalIso(e),
          allDay: ev.start.allDay,
          placeName: ev.location ? ev.location.slice(0, 255) : '',
          notes: ev.description ? ev.description.slice(0, 1000) : '',
          uid: ev.uid ?? null,
          recurring: Boolean(ev.rule),
        });
      }
      continue;
    }
    switch (line.name) {
      case 'SUMMARY':
        current.summary = unescapeText(line.value).trim();
        break;
      case 'LOCATION':
        current.location = unescapeText(line.value).trim();
        break;
      case 'DESCRIPTION':
        current.description = unescapeText(line.value).trim();
        break;
      case 'UID':
        current.uid = line.value.trim();
        break;
      case 'STATUS':
        current.status = line.value.trim().toUpperCase();
        break;
      case 'DTSTART':
        current.start = parseDateValue(line.value, line.params);
        break;
      case 'DTEND':
        current.end = parseDateValue(line.value, line.params);
        break;
      case 'DURATION':
        current.duration = parseDuration(line.value);
        break;
      case 'RRULE':
        current.rule = parseRule(line.value);
        break;
      case 'EXDATE':
        for (const v of line.value.split(',')) {
          const x = parseDateValue(v, line.params);
          if (x) current.exdates.push(x.date);
        }
        break;
      default:
    }
  }
  events.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return { events, calendarName, skipped };
}
