import { describe, expect, it } from 'vitest';
import {
  allDayOn,
  layoutDay,
  onDay,
  parseLocal,
  snapMinutes,
  startOfWeek,
  toLocalIso,
} from '../lib/planner';
import { findNote, backlinks, linkify, noteExcerpt, noteHeading, tagsOf } from '../lib/markdown';

const day = new Date(2026, 8, 18); // Friday 18 September 2026
const ev = (id, start, end, extra = {}) => ({
  id,
  title: `e${id}`,
  startsAt: `2026-09-18T${start}:00`,
  endsAt: `2026-09-18T${end}:00`,
  allDay: false,
  ...extra,
});

describe('planner dates', () => {
  it('round-trips local times without a UTC shift', () => {
    const iso = '2026-09-18T23:30:00';
    expect(toLocalIso(parseLocal(iso))).toBe(iso);
  });

  it('starts weeks on Monday', () => {
    expect(startOfWeek(day).getDate()).toBe(14);
    // A Sunday belongs to the week that began six days earlier.
    expect(startOfWeek(new Date(2026, 8, 20)).getDate()).toBe(14);
  });

  it('snaps to quarter hours and stays inside the day', () => {
    expect(snapMinutes(67)).toBe(60);
    expect(snapMinutes(68)).toBe(75);
    expect(snapMinutes(-20)).toBe(0);
    expect(snapMinutes(2000)).toBe(1440);
  });

  it('counts an event on every day it touches, and not on the day it ends at midnight', () => {
    const trip = { startsAt: '2026-09-17T00:00:00', endsAt: '2026-09-19T00:00:00', allDay: true };
    expect(onDay(trip, new Date(2026, 8, 17))).toBe(true);
    expect(onDay(trip, new Date(2026, 8, 18))).toBe(true);
    expect(onDay(trip, new Date(2026, 8, 19))).toBe(false);
    expect(allDayOn([trip], day)).toHaveLength(1);
  });
});

describe('layoutDay', () => {
  it('gives events that do not overlap the full width', () => {
    const out = layoutDay([ev(1, '09:00', '10:00'), ev(2, '10:00', '11:00')], day);
    expect(out.map((o) => o.columns)).toEqual([1, 1]);
  });

  it('puts overlapping events side by side, sharing one column count', () => {
    const out = layoutDay([ev(1, '09:00', '11:00'), ev(2, '09:30', '10:00'), ev(3, '10:30', '12:00')], day);
    const byId = Object.fromEntries(out.map((o) => [o.event.id, o]));
    expect(byId[1].column).toBe(0);
    expect(byId[2].column).toBe(1);
    // 3 starts after 2 ended, so it reuses column 1.
    expect(byId[3].column).toBe(1);
    expect(out.every((o) => o.columns === 2)).toBe(true);
  });

  it('clips an overnight event to the part on this day', () => {
    const late = { id: 9, startsAt: '2026-09-17T22:00:00', endsAt: '2026-09-18T02:00:00', allDay: false };
    const [item] = layoutDay([late], day);
    expect(item.top).toBe(0);
    expect(item.bottom).toBe(120);
  });

  it('leaves all-day events out of the timed grid', () => {
    const allDay = { id: 5, startsAt: '2026-09-18T00:00:00', endsAt: '2026-09-19T00:00:00', allDay: true };
    expect(layoutDay([allDay], day)).toEqual([]);
  });
});

describe('markdown notes', () => {
  const notes = [
    { id: 1, title: 'Running plan', body: 'Build to 10k. See [[Physio]].' },
    { id: 2, title: null, body: '# Physio\nStop at **20 minutes**. #health #knee' },
  ];

  it('turns [[links]] and #tags into private links, leaving code alone', () => {
    expect(linkify('See [[Physio]] #knee')).toBe('See [Physio](note:Physio) [#knee](tag:knee)');
    expect(linkify('[[Physio|the physio]]')).toBe('[the physio](note:Physio)');
    expect(linkify('`#include [[x]]`')).toBe('`#include [[x]]`');
    expect(linkify('```\n#not-a-tag\n```')).toBe('```\n#not-a-tag\n```');
    // A heading marker is not a tag.
    expect(linkify('# Title')).toBe('# Title');
  });

  it('names an untitled note by its first line without Markdown marks', () => {
    expect(noteHeading(notes[1])).toBe('Physio');
    expect(noteExcerpt(notes[1])).toBe('Stop at 20 minutes. #health #knee');
  });

  it('resolves links by heading, ignoring case, and finds backlinks', () => {
    expect(findNote(notes, 'physio')?.id).toBe(2);
    expect(findNote(notes, 'Nope')).toBeNull();
    expect(backlinks(notes, notes[1]).map((n) => n.id)).toEqual([1]);
  });

  it('drops a link target with parentheses in it from the excerpt', () => {
    expect(noteExcerpt({ title: 'x', body: 'A [bad link](javascript:alert(1)) here' })).toBe('A bad link here');
  });

  it('collects each tag once', () => {
    expect(tagsOf({ body: '#knee then #Knee and #health' })).toEqual(['knee', 'health']);
  });
});
