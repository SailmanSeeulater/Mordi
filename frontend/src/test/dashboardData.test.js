import { describe, it, expect } from 'vitest';
import {
  toIsoDate,
  startOfWeek,
  formatWeekRange,
  goalTarget,
  targetLabel,
  dayStatus,
  buildSegments,
  weekSummary,
  currentStreak,
  recentEntries,
} from '../pages/dashboardData';

const day = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const log = (goalId, logDate, completed = true, extra = {}) => ({
  goal: goalId == null ? null : { id: goalId },
  logDate,
  completed,
  ...extra,
});

describe('startOfWeek', () => {
  it('returns the Monday for any day in the week', () => {
    const monday = startOfWeek(day('2026-09-16'));
    expect(monday.getDay()).toBe(1);
    expect(toIsoDate(monday)).toBe('2026-09-14');
  });

  it('treats Sunday as the last day of the week, not the first', () => {
    expect(toIsoDate(startOfWeek(day('2026-09-20')))).toBe('2026-09-14');
  });

  it('crosses month boundaries', () => {
    expect(toIsoDate(startOfWeek(day('2026-10-01')))).toBe('2026-09-28');
  });
});

describe('formatWeekRange', () => {
  it('omits the repeated month within a month', () => {
    expect(formatWeekRange(day('2026-09-14'))).toBe('Sep 14 – 20');
  });

  it('names both months when the week spans two', () => {
    expect(formatWeekRange(day('2026-09-28'))).toBe('Sep 28 – Oct 4');
  });
});

describe('goalTarget', () => {
  it('uses targetPerWeek when present', () => {
    expect(goalTarget({ targetPerWeek: 4 })).toBe(4);
    expect(targetLabel({ targetPerWeek: 4 })).toBe('4× weekly');
    expect(targetLabel({ targetPerWeek: 7 })).toBe('daily');
  });

  it('falls back to frequency for goals without targetPerWeek', () => {
    expect(goalTarget({ frequency: 'daily' })).toBe(7);
    expect(goalTarget({ frequency: 'weekly' })).toBe(1);
    expect(goalTarget({})).toBe(1);
  });
});

describe('dayStatus', () => {
  const daily = { id: 1, targetPerWeek: 7 };
  const weekly = { id: 2, targetPerWeek: 3 };
  const today = '2026-09-16';

  it('is blank for future days even if something is logged', () => {
    expect(dayStatus(daily, [log(1, '2026-09-17')], '2026-09-17', today)).toBe('empty');
  });

  it('is done when any log that day is completed', () => {
    const logs = [log(1, today, false), log(1, today, true)];
    expect(dayStatus(daily, logs, today, today)).toBe('done');
  });

  it('is missed when the only logs are not completed', () => {
    expect(dayStatus(weekly, [log(2, '2026-09-15', false)], '2026-09-15', today)).toBe('missed');
  });

  it('marks unlogged past days missed only for daily goals', () => {
    expect(dayStatus(daily, [], '2026-09-15', today)).toBe('missed');
    expect(dayStatus(weekly, [], '2026-09-15', today)).toBe('empty');
  });

  it('leaves an unlogged today open', () => {
    expect(dayStatus(daily, [], today, today)).toBe('empty');
  });

  it('does not mark days before the goal existed as missed', () => {
    const newGoal = { ...daily, createdAt: '2026-09-15T10:00:00' };
    expect(dayStatus(newGoal, [], '2026-09-14', today)).toBe('empty');
    expect(dayStatus(newGoal, [], '2026-09-15', today)).toBe('missed');
  });
});

describe('buildSegments', () => {
  it('merges consecutive runs of the same status and skips blanks', () => {
    const statuses = ['done', 'done', 'done', 'missed', 'done', 'empty', 'done'];
    expect(buildSegments(statuses)).toEqual([
      { start: 0, length: 3, status: 'done' },
      { start: 3, length: 1, status: 'missed' },
      { start: 4, length: 1, status: 'done' },
      { start: 6, length: 1, status: 'done' },
    ]);
  });

  it('returns nothing for an empty week', () => {
    expect(buildSegments(Array(7).fill('empty'))).toEqual([]);
  });
});

describe('weekSummary', () => {
  const weekStart = day('2026-09-14');
  const today = day('2026-09-16');
  const goals = [
    { id: 1, targetPerWeek: 2 },
    { id: 2, targetPerWeek: 7 },
  ];

  it('caps each goal at its target when computing the percent', () => {
    const behaviors = [
      log(1, '2026-09-14', true, { mood: 'good' }),
      log(1, '2026-09-15', true, { mood: 'good' }),
      log(1, '2026-09-16', true, { mood: 'great' }),
      log(2, '2026-09-16', true, { mood: 'good' }),
    ];
    const summary = weekSummary(goals, behaviors, weekStart, today);

    expect(summary.rows[0].done).toBe(3);
    // goal 1: min(3, 2) = 2, goal 2: 1 of 7 -> 3 / 9
    expect(summary.percent).toBe(33);
    // goal 2 missed Mon + Tue
    expect(summary.missed).toBe(2);
    expect(summary.entries).toBe(4);
    expect(summary.topMood).toBe('good');
  });

  it('ignores entries outside the week and entries without a goal in the grid', () => {
    const behaviors = [log(1, '2026-09-13'), log(null, '2026-09-15')];
    const summary = weekSummary(goals, behaviors, weekStart, today);

    expect(summary.rows[0].done).toBe(0);
    expect(summary.entries).toBe(1);
  });

  it('reports 0% with no goals', () => {
    expect(weekSummary([], [], weekStart, today).percent).toBe(0);
  });
});

describe('currentStreak', () => {
  const today = day('2026-09-16');

  it('counts consecutive completed days ending today', () => {
    const behaviors = [log(1, '2026-09-16'), log(2, '2026-09-15'), log(1, '2026-09-14')];
    expect(currentStreak(behaviors, today)).toBe(3);
  });

  it('keeps a streak alive when today is not logged yet', () => {
    expect(currentStreak([log(1, '2026-09-15'), log(1, '2026-09-14')], today)).toBe(2);
  });

  it('ignores logs that were not completed', () => {
    expect(currentStreak([log(1, '2026-09-16', false), log(1, '2026-09-15')], today)).toBe(1);
  });

  it('is zero after a gap', () => {
    expect(currentStreak([log(1, '2026-09-13')], today)).toBe(0);
  });
});

describe('recentEntries', () => {
  it('sorts newest day first, then newest time within a day', () => {
    const behaviors = [
      log(1, '2026-09-14', true, { createdAt: '2026-09-14T08:00:00', note: 'a' }),
      log(1, '2026-09-15', true, { createdAt: '2026-09-15T07:00:00', note: 'b' }),
      log(1, '2026-09-15', true, { createdAt: '2026-09-15T21:00:00', note: 'c' }),
    ];
    expect(recentEntries(behaviors, 2).map((b) => b.note)).toEqual(['c', 'b']);
  });
});
