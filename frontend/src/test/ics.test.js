import { describe, expect, it } from 'vitest';
import { parseDateValue, parseIcs } from '../lib/ics';

const NOW = new Date(2026, 8, 18, 12, 0); // Fri 18 Sep 2026, local
const wrap = (body) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nX-WR-CALNAME:Work\r\n${body}\r\nEND:VCALENDAR\r\n`;

describe('parseIcs', () => {
  it('reads a timed event, unfolding long lines and unescaping text', () => {
    const { events, calendarName } = parseIcs(
      wrap(
        'BEGIN:VEVENT\r\nUID:1\r\nSUMMARY:Planning\\, part one\r\nDTSTART:20260921T090000\r\nDTEND:20260921T103000\r\n' +
          'DESCRIPTION:Bring the\\nnotes and the long\r\n  agenda\r\nLOCATION:Room 4\r\nEND:VEVENT',
      ),
      { now: NOW },
    );
    expect(calendarName).toBe('Work');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      title: 'Planning, part one',
      startsAt: '2026-09-21T09:00:00',
      endsAt: '2026-09-21T10:30:00',
      allDay: false,
      placeName: 'Room 4',
      notes: 'Bring the\nnotes and the long agenda',
    });
  });

  it('reads all-day events as whole days, end exclusive', () => {
    const { events } = parseIcs(
      wrap('BEGIN:VEVENT\r\nSUMMARY:Trip\r\nDTSTART;VALUE=DATE:20260925\r\nDTEND;VALUE=DATE:20260928\r\nEND:VEVENT'),
      { now: NOW },
    );
    expect(events[0]).toMatchObject({ allDay: true, startsAt: '2026-09-25T00:00:00', endsAt: '2026-09-28T00:00:00' });
  });

  it('converts UTC times to local time', () => {
    const { events } = parseIcs(wrap('BEGIN:VEVENT\r\nSUMMARY:Call\r\nDTSTART:20260922T160000Z\r\nDURATION:PT45M\r\nEND:VEVENT'), { now: NOW });
    const start = new Date(Date.UTC(2026, 8, 22, 16, 0));
    const pad = (n) => String(n).padStart(2, '0');
    expect(events[0].startsAt).toBe(
      `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}:00`,
    );
    expect(new Date(events[0].endsAt) - new Date(events[0].startsAt)).toBe(45 * 60_000);
  });

  it('converts a named time zone through the instant it names', () => {
    const tokyo = parseDateValue('20260922T090000', { TZID: 'Asia/Tokyo' }).date;
    // 09:00 in Tokyo (UTC+9, no DST) is 00:00 UTC.
    expect(tokyo.toISOString()).toBe('2026-09-22T00:00:00.000Z');
  });

  it('expands a weekly rule with BYDAY inside the window, honouring COUNT and EXDATE', () => {
    const { events } = parseIcs(
      wrap(
        'BEGIN:VEVENT\r\nSUMMARY:Gym\r\nDTSTART:20260921T070000\r\nDTEND:20260921T080000\r\n' +
          'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=6\r\nEXDATE:20260923T070000\r\nEND:VEVENT',
      ),
      { now: NOW },
    );
    expect(events.map((e) => e.startsAt.slice(0, 10))).toEqual([
      '2026-09-21',
      '2026-09-25',
      '2026-09-28',
      '2026-09-30',
      '2026-10-02',
    ]);
    expect(events.every((e) => e.recurring)).toBe(true);
  });

  it('bounds an endless rule to the import window', () => {
    const { events } = parseIcs(
      wrap('BEGIN:VEVENT\r\nSUMMARY:Standup\r\nDTSTART:20200101T100000\r\nRRULE:FREQ=DAILY\r\nEND:VEVENT'),
      { now: NOW, pastDays: 7, futureDays: 14 },
    );
    expect(events.length).toBeGreaterThanOrEqual(21);
    expect(events.length).toBeLessThanOrEqual(22);
    expect(events[0].startsAt >= '2026-09-11').toBe(true);
  });

  it('skips cancelled, startless and over-long events', () => {
    const { events, skipped } = parseIcs(
      wrap(
        'BEGIN:VEVENT\r\nSUMMARY:Gone\r\nSTATUS:CANCELLED\r\nDTSTART:20260921T090000\r\nEND:VEVENT\r\n' +
          'BEGIN:VEVENT\r\nSUMMARY:No start\r\nEND:VEVENT\r\n' +
          'BEGIN:VEVENT\r\nSUMMARY:Sabbatical\r\nDTSTART;VALUE=DATE:20260921\r\nDTEND;VALUE=DATE:20261221\r\nEND:VEVENT',
      ),
      { now: NOW },
    );
    expect(events).toHaveLength(0);
    expect(skipped).toBe(3);
  });
});
