import { describe, expect, it } from 'vitest';
import {
  ALL_DAYS,
  daysToMask,
  hasPlannedDays,
  isPlannedOn,
  isoDayOrder,
  maskToDays,
  plannedDaysLabel,
  plannedDueBy,
  plannedDueByIndex,
  plannedGoalsOn,
} from '../lib/plannedDays';
import { expectedBy, weekPace, weekSummary, dayStatus } from '../pages/dashboardData';
import { composeReminder } from '../lib/reminder';
import { suggestTarget } from '../lib/targets';
import { buildWeekReport } from '../lib/weekReport';

// Monday, Wednesday and Friday: bits 0, 2 and 4.
const MON_WED_FRI = 0b001_0101;

const day = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// The week of Monday 14 September 2026.
const MON = '2026-09-14';
const TUE = '2026-09-15';
const WED = '2026-09-16';
const THU = '2026-09-17';

const run = { id: 1, title: 'Morning run', targetPerWeek: 3, plannedDays: MON_WED_FRI };
const read = { id: 2, title: 'Read', targetPerWeek: 3 };
const log = (goal, logDate, completed = true) => ({ goal: { id: goal.id, title: goal.title }, logDate, completed });

describe('masks and lists', () => {
  it('turns a mask into ISO weekday indexes and back', () => {
    expect(maskToDays(MON_WED_FRI)).toEqual([0, 2, 4]);
    expect(maskToDays(ALL_DAYS)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(maskToDays(0)).toEqual([]);
    expect(maskToDays(null)).toEqual([]);
    expect(daysToMask([4, 0, 2])).toBe(MON_WED_FRI);
    expect(daysToMask([])).toBe(0);
    expect(daysToMask([0, 0, 9, -1])).toBe(1);
  });

  it('knows whether a goal has days at all', () => {
    expect(hasPlannedDays(run)).toBe(true);
    expect(hasPlannedDays(read)).toBe(false);
    expect(hasPlannedDays({ plannedDays: 0 })).toBe(false);
    expect(hasPlannedDays(null)).toBe(false);
  });
});

describe('isPlannedOn', () => {
  it('reads Dates and ISO strings, Monday as bit 0 and Sunday as bit 6', () => {
    expect(isPlannedOn(run, MON)).toBe(true);
    expect(isPlannedOn(run, TUE)).toBe(false);
    expect(isPlannedOn(run, day(WED))).toBe(true);
    expect(isPlannedOn({ plannedDays: 0b100_0000 }, '2026-09-20')).toBe(true); // a Sunday
    expect(isPlannedOn(read, MON)).toBe(false);
  });
});

describe('plannedDaysLabel', () => {
  it('orders the days as the calendar starts its week', () => {
    const weekend = { plannedDays: daysToMask([0, 5, 6]) };
    expect(plannedDaysLabel(run)).toBe('Mon, Wed, Fri');
    expect(plannedDaysLabel(weekend, 'monday')).toBe('Mon, Sat, Sun');
    expect(plannedDaysLabel(weekend, 'sunday')).toBe('Sun, Mon, Sat');
    expect(isoDayOrder('sunday')).toEqual([6, 0, 1, 2, 3, 4, 5]);
  });

  it('says every day for all seven, and nothing without days', () => {
    expect(plannedDaysLabel({ plannedDays: ALL_DAYS })).toBe('Every day');
    expect(plannedDaysLabel(read)).toBe('');
  });
});

describe('plannedDueBy', () => {
  it('counts the planned days so far this Monday-to-Sunday week, today included', () => {
    expect(plannedDueBy(run, MON)).toBe(1);
    expect(plannedDueBy(run, TUE)).toBe(1);
    expect(plannedDueBy(run, WED)).toBe(2);
    expect(plannedDueBy(run, '2026-09-20')).toBe(3);
    expect(plannedDueByIndex(run, 3)).toBe(2);
    expect(plannedDueBy(read, '2026-09-20')).toBe(0);
  });
});

describe('plannedGoalsOn', () => {
  it('lists the goals planned for a day with whether each was done', () => {
    const behaviors = [log(run, MON), log(run, WED, false)];
    expect(plannedGoalsOn([run, read], behaviors, MON)).toEqual([{ goal: run, done: true }]);
    expect(plannedGoalsOn([run, read], behaviors, WED)).toEqual([{ goal: run, done: false }]);
    expect(plannedGoalsOn([run, read], behaviors, TUE)).toEqual([]);
  });
});

describe('missed days', () => {
  it('reads an empty past planned day as missed, and an unplanned one as rest', () => {
    expect(dayStatus(run, [], MON, THU)).toBe('missed');
    expect(dayStatus(run, [], TUE, THU)).toBe('empty');
    // Today is never missed yet.
    expect(dayStatus(run, [], WED, WED)).toBe('empty');
    // Nor a planned day before the goal existed.
    expect(dayStatus({ ...run, createdAt: '2026-09-15T08:00:00' }, [], MON, THU)).toBe('empty');
  });

  it('leaves goals without planned days as they were: only a daily goal misses an empty day', () => {
    expect(dayStatus(read, [], MON, THU)).toBe('empty');
    expect(dayStatus({ id: 3, targetPerWeek: 7 }, [], MON, THU)).toBe('missed');
  });

  it('counts a run moved to an unplanned day toward the target, and still marks the planned day missed', () => {
    const summary = weekSummary([run], [log(run, TUE)], day(MON), day(THU));
    const row = summary.rows[0];
    expect(row.done).toBe(1);
    expect(row.statuses.slice(0, 4)).toEqual(['missed', 'done', 'missed', 'empty']);
  });
});

describe('pace with planned days', () => {
  it('is exactly the even spread for goals without planned days', () => {
    // Targets 4, 3, 7 (14 in all): by Thursday 8 are due, as weekPace(14, …, 3).
    const rows = [4, 3, 7].map((target, i) => ({ goal: { id: i, targetPerWeek: target }, target }));
    for (let d = 0; d < 7; d += 1) {
      expect(expectedBy(rows, d)).toBe(weekPace(14, 0, d).expected);
      expect(weekPace(14, 5, d, rows)).toEqual(weekPace(14, 5, d));
    }
  });

  it('owes a planned goal its planned days so far', () => {
    const rows = [{ goal: run, target: 3 }];
    // Tuesday: only Monday was due.
    expect(weekPace(3, 1, 1, rows)).toEqual({ expected: 1, delta: 0, state: 'on' });
    // Wednesday: Monday and Wednesday.
    expect(weekPace(3, 1, 2, rows)).toEqual({ expected: 2, delta: -1, state: 'behind' });
    // Done on Tuesday instead of Monday still counts: on pace on Tuesday.
    expect(weekPace(3, 1, 1, rows).state).toBe('on');
  });

  it('mixes planned and spread goals before rounding once', () => {
    // Run (Mon/Wed/Fri) owes 2 by Thursday; Read (3 a week, spread) owes 12/7.
    const rows = [
      { goal: run, target: 3 },
      { goal: read, target: 3 },
    ];
    expect(expectedBy(rows, 3)).toBe(Math.round(2 + 12 / 7));
  });
});

describe('reminder with planned days', () => {
  const rows = (behaviors, today) => weekSummary([run, read], behaviors, day(MON), day(today)).rows;

  it('lists a planned goal only on a planned day it isn’t done yet', () => {
    // Thursday: not a run day. Read is still listed, as before.
    expect(composeReminder(rows([], THU), 3).items.map((i) => i.title)).toEqual(['Read']);
    // Wednesday, not run yet: listed.
    expect(composeReminder(rows([], WED), 2).items.map((i) => i.title)).toEqual(['Morning run', 'Read']);
    // Wednesday, run done: not listed.
    expect(composeReminder(rows([log(run, WED)], WED), 2).items.map((i) => i.title)).toEqual(['Read']);
  });
});

describe('target suggestions', () => {
  it('never offers a new number to a goal whose days set it', () => {
    const old = { ...run, createdAt: '2026-01-01T00:00:00' };
    const behaviors = ['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21', '2026-08-24', '2026-08-25',
      '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04',
      '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'].map((d) => log(old, d));
    expect(suggestTarget(old, behaviors, day(THU))).toBeNull();
    expect(suggestTarget({ ...old, plannedDays: null }, behaviors, day(THU))?.kind).toBe('raise');
    expect(suggestTarget(old, [], day(THU))?.kind).toBe('idle');
  });
});

describe('week report', () => {
  it('marks planned cells so a missed planned day is visible', () => {
    const report = buildWeekReport({ goals: [run, read], behaviors: [log(run, TUE)], weekStart: day(MON), today: day(THU) });
    const runCells = report.matrix[0].cells;
    expect(runCells.map((c) => c.planned)).toEqual([true, false, true, false, true, false, false]);
    expect(runCells[0].status).toBe('missed');
    expect(report.matrix[1].cells.every((c) => !c.planned)).toBe(true);
  });
});
