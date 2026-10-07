import { describe, expect, it } from 'vitest';
import { buildWeekReport, headline, hoursMinutes } from '../lib/weekReport';

const run = { id: 1, title: 'Run', targetPerWeek: 3, frequency: 'weekly' };
const read = { id: 2, title: 'Read', targetPerWeek: 7, frequency: 'daily' };
const archived = { id: 9, title: 'Old goal', targetPerWeek: 2, frequency: 'weekly' };
const e = (id, goal, logDate, extra = {}) => ({ id, goal, logDate, completed: true, note: 'x', mood: null, ...extra });

// Week of Mon 14 Sep 2026; "today" is the following Monday so every day is past.
const today = new Date(2026, 8, 21);
const weekStart = new Date(2026, 8, 16); // a Wednesday: normalised to Monday

const behaviors = [
  e(1, run, '2026-09-14', { mood: 'great', durationSeconds: 1800, placeName: 'Park' }),
  e(2, run, '2026-09-16', { mood: 'good', placeName: 'Park' }),
  e(3, run, '2026-09-18', { mood: 'good' }),
  e(4, read, '2026-09-14', { mood: 'neutral' }),
  e(5, read, '2026-09-15', { completed: false, mood: 'bad' }),
  e(6, null, '2026-09-15', { note: 'Taxes', durationSeconds: 3600 }),
  e(7, archived, '2026-09-19'),
  // last week
  e(8, run, '2026-09-08'),
  e(9, read, '2026-09-09'),
];

describe('buildWeekReport', () => {
  const r = buildWeekReport({ goals: [run, read], behaviors, weekStart, today });

  it('measures against the targets, including a goal archived mid-week', () => {
    // run 3/3, read 1/7 (one day done), archived goal 1/2
    expect(r.goalsTotal).toBe(3);
    expect(r.planned).toBe(12);
    expect(r.achieved).toBe(5);
    expect(r.percent).toBe(42);
    expect(r.goalsOnTarget).toBe(1);
  });

  it('counts each day, splitting done from not done, and last week alongside', () => {
    expect(r.perDay.map((d) => d.total)).toEqual([2, 2, 1, 0, 1, 1, 0]);
    expect(r.perDay[1]).toMatchObject({ completed: 1, notDone: 1 });
    expect(r.perDay.map((d) => d.prevTotal)).toEqual([0, 1, 1, 0, 0, 0, 0]);
    expect(r.activeDays).toBe(5);
    expect(r.busiest.iso).toBe('2026-09-14');
  });

  it('adds up tracked time by activity, largest first', () => {
    expect(r.trackedSeconds).toBe(5400);
    expect(r.time[0]).toEqual({ name: 'Taxes', seconds: 3600 });
    expect(r.time[1]).toEqual({ name: 'Run', seconds: 1800 });
  });

  it('keeps the mood mix in scale order and averages mood per day', () => {
    expect(r.moods.map((m) => m.count)).toEqual([1, 2, 1, 1, 0]);
    expect(r.perDay[0].mood).toBe(1); // great (2) and neutral (0)
    expect(r.perDay[3].mood).toBeNull();
  });

  it('finds the longest run of days with something done', () => {
    // 14, 15 (Taxes done), 16 → 3 days; 17 empty; 18, 19 → 2
    expect(r.longestRun).toBe(3);
  });

  it('counts places and planned time on the calendar', () => {
    const withPlan = buildWeekReport({
      goals: [run],
      behaviors,
      events: [
        { startsAt: '2026-09-14T09:00:00', endsAt: '2026-09-14T10:30:00', allDay: false },
        { startsAt: '2026-09-13T23:00:00', endsAt: '2026-09-14T01:00:00', allDay: false }, // half inside
        { startsAt: '2026-09-15T00:00:00', endsAt: '2026-09-16T00:00:00', allDay: true },
      ],
      weekStart,
      today,
    });
    expect(withPlan.places).toEqual([{ name: 'Park', count: 2 }]);
    expect(withPlan.plan).toMatchObject({ events: 3, timedEvents: 2, plannedSeconds: 5400 + 3600 });
  });

  it('counts planned blocks that happened and were skipped', () => {
    const r2 = buildWeekReport({
      goals: [run],
      behaviors,
      events: [
        { startsAt: '2026-09-14T07:00:00', endsAt: '2026-09-14T08:00:00', allDay: false, outcome: 'done' },
        { startsAt: '2026-09-15T07:00:00', endsAt: '2026-09-15T08:00:00', allDay: false, outcome: 'skipped' },
        { startsAt: '2026-09-16T07:00:00', endsAt: '2026-09-16T08:00:00', allDay: false },
      ],
      weekStart,
      today,
    });
    expect(r2.plan).toMatchObject({ ended: 3, done: 1, skipped: 1 });
  });

  it('places logged moments on a weekday-by-hour grid in local time', () => {
    const at = (y, m, d, h) => new Date(y, m, d, h, 15).toISOString();
    const r3 = buildWeekReport({
      goals: [run],
      behaviors: [
        e(20, run, '2026-09-14', { loggedAt: at(2026, 8, 14, 7) }),
        e(21, run, '2026-09-14', { loggedAt: at(2026, 8, 14, 7) }),
        e(22, run, '2026-09-18', { loggedAt: at(2026, 8, 18, 21) }),
        e(23, run, '2026-09-19'), // no time: left out, not guessed
      ],
      weekStart,
      today,
    });
    expect(r3.hours[0][7]).toBe(2); // Monday, 7am
    expect(r3.hours[4][21]).toBe(1); // Friday, 9pm
    expect(r3.timedEntries).toBe(3);
  });

  it('writes a headline that compares with last week only when it can', () => {
    expect(headline(r)).toMatch(/^You hit 5 of 12 planned days, \d+ points (up on|down from) last week\.$/);
    const empty = buildWeekReport({ goals: [], behaviors: [], weekStart, today });
    expect(headline(empty)).toBe('Nothing was logged this week.');
  });
});

describe('hoursMinutes', () => {
  it('writes durations compactly', () => {
    expect(hoursMinutes(0)).toBe('0m');
    expect(hoursMinutes(45 * 60)).toBe('45m');
    expect(hoursMinutes(3600)).toBe('1h');
    expect(hoursMinutes(3 * 3600 + 20 * 60)).toBe('3h 20m');
  });
});

describe('finished to-dos in the week', () => {
  const todo = (id, completedOn, completedAt, extra = {}) => ({
    id, text: `Task ${id}`, done: true, completedOn, completedAt, ...extra,
  });
  const todos = [
    todo(1, '2026-09-15', '2026-09-15T18:00:00Z'),
    todo(2, '2026-09-14', '2026-09-14T09:00:00Z'),
    todo(3, '2026-09-15', '2026-09-15T08:00:00Z'),
    todo(4, '2026-09-08', '2026-09-08T08:00:00Z'), // last week
    todo(5, '2026-09-22', '2026-09-22T08:00:00Z'), // next week
    todo(6, '2026-09-16', null, { done: false, completedOn: null }), // reopened
  ];
  const r = buildWeekReport({ goals: [run, read], behaviors, todos, weekStart, today });

  it('counts this week and last, apart from the goals and their percentages', () => {
    expect(r.todosDone).toBe(3);
    expect(r.prevTodosDone).toBe(1);
    const withoutTodos = buildWeekReport({ goals: [run, read], behaviors, weekStart, today });
    expect(r.percent).toBe(withoutTodos.percent);
    expect(r.entries).toBe(withoutTodos.entries);
  });

  it('lists them in the order they were finished, with their days', () => {
    expect(r.finishedTodos.map((t) => t.id)).toEqual([2, 3, 1]);
    expect(r.finishedTodos[0]).toMatchObject({ text: 'Task 2', iso: '2026-09-14' });
  });

  it('puts them on their days', () => {
    expect(r.perDay.map((d) => d.todos)).toEqual([1, 2, 0, 0, 0, 0, 0]);
  });

  it('has no to-dos to show when none were given', () => {
    const none = buildWeekReport({ goals: [run], behaviors, weekStart, today });
    expect(none.todosDone).toBe(0);
    expect(none.finishedTodos).toEqual([]);
  });

  it('a week of only to-dos still gets a headline about them', () => {
    const only = buildWeekReport({ goals: [], behaviors: [], todos, weekStart, today });
    expect(headline(only)).toBe('You finished 3 to-dos, with no entries logged.');
  });
});
