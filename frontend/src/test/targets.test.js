import { describe, expect, it } from 'vitest';
import { formatAverage, suggestTarget } from '../lib/targets';

// Friday 18 Sep 2026. The last four complete weeks start Aug 17, 24, 31, Sep 7.
const today = new Date(2026, 8, 18);
const old = '2026-06-01T09:00:00';
const goal = (target, extra = {}) => ({ id: 1, title: 'Run', targetPerWeek: target, createdAt: old, ...extra });
const done = (...dates) => dates.map((logDate, i) => ({ id: i, goal: { id: 1 }, logDate, completed: true }));

// n completed days in each of the four weeks.
function weeksOf(...perWeek) {
  const mondays = ['2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07'];
  const out = [];
  perWeek.forEach((n, w) => {
    const [y, m, d] = mondays[w].split('-').map(Number);
    for (let i = 0; i < n; i += 1) {
      const day = new Date(y, m - 1, d + i);
      out.push(`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`);
    }
  });
  return done(...out);
}

describe('suggestTarget', () => {
  it('offers to raise a target the person keeps beating', () => {
    expect(suggestTarget(goal(3), weeksOf(5, 4, 5, 4), today)).toMatchObject({ kind: 'raise', to: 5 });
  });

  it('offers to lower a target the person keeps missing', () => {
    expect(suggestTarget(goal(5), weeksOf(2, 3, 2, 2), today)).toMatchObject({ kind: 'lower', to: 2 });
  });

  it('says nothing when the target is close to what happens', () => {
    expect(suggestTarget(goal(4), weeksOf(4, 3, 5, 4), today)).toBeNull();
    expect(suggestTarget(goal(4), weeksOf(3, 3, 3, 3), today)).toBeNull();
  });

  it('points out a goal with nothing logged in a month', () => {
    expect(suggestTarget(goal(3), [], today)).toMatchObject({ kind: 'idle', weeks: 4 });
  });

  it('ignores the week in progress and other goals, and counts a day once', () => {
    const noise = [
      ...done('2026-09-14', '2026-09-15', '2026-09-16'), // this week
      { id: 99, goal: { id: 2 }, logDate: '2026-08-18', completed: true }, // another goal
      { id: 98, goal: { id: 1 }, logDate: '2026-08-19', completed: false }, // not done
    ];
    const twiceADay = [...weeksOf(1, 1, 1, 1), ...weeksOf(1, 1, 1, 1)];
    expect(suggestTarget(goal(4), [...noise, ...twiceADay], today)).toMatchObject({ kind: 'lower', to: 1 });
  });

  it('waits until a goal is old enough to have a pattern', () => {
    expect(suggestTarget(goal(3, { createdAt: '2026-09-01T09:00:00' }), [], today)).toBeNull();
  });

  it('never suggests more than every day', () => {
    expect(suggestTarget(goal(5), weeksOf(7, 7, 7, 7), today)).toMatchObject({ kind: 'raise', to: 7 });
    expect(suggestTarget(goal(7), weeksOf(7, 7, 7, 7), today)).toBeNull();
  });
});

describe('formatAverage', () => {
  it('drops a trailing .0', () => {
    expect(formatAverage(3)).toBe('3');
    expect(formatAverage(2.25)).toBe('2.3');
  });
});
