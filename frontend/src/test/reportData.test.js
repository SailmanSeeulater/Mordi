import { describe, expect, it } from 'vitest';
import {
  normaliseReport,
  reportWeekLabel,
  sortReports,
  weekOnWeekDelta,
} from '../pages/reportData';

const modern = (over = {}) => ({
  id: 1,
  weekStart: '2026-09-07',
  weekEnd: '2026-09-13',
  totalBehaviors: 12,
  completedBehaviors: 11,
  completionRate: 68.42,
  mostCommonMood: 'good',
  summary: 'a summary',
  plannedEntries: 19,
  achievedEntries: 13,
  goalsOnTrack: 2,
  goalsTotal: 4,
  ...over,
});

const legacy = (over = {}) => ({
  id: 2,
  weekStart: '2026-08-31',
  weekEnd: '2026-09-06',
  totalBehaviors: 9,
  completedBehaviors: 7,
  completionRate: 77.7,
  mostCommonMood: 'good',
  summary: 'an old summary',
  plannedEntries: null,
  achievedEntries: null,
  goalsOnTrack: null,
  goalsTotal: null,
  ...over,
});

describe('normaliseReport', () => {
  it('reads a current row as achieved out of planned', () => {
    const row = normaliseReport(modern());
    expect(row.legacy).toBe(false);
    expect(row.percent).toBe(68);
    expect(row.planned).toBe(19);
    expect(row.achieved).toBe(13);
  });

  it('marks a row written before the rework and reads it as ticked of logged', () => {
    const row = normaliseReport(legacy());
    expect(row.legacy).toBe(true);
    expect(row.percent).toBe(78);
    expect(row.planned).toBe(9);
    expect(row.achieved).toBe(7);
  });

  it('treats a row with only one of the two new counts as legacy', () => {
    // A half-written row must not be read as if planned were 0.
    expect(normaliseReport(modern({ achievedEntries: null })).legacy).toBe(true);
  });

  it('does not divide by zero when nothing was planned', () => {
    const row = normaliseReport(modern({ plannedEntries: 0, achievedEntries: 0 }));
    expect(row.percent).toBe(0);
  });

  it('does not divide by zero when nothing was logged in a legacy row', () => {
    const row = normaliseReport(legacy({ totalBehaviors: 0, completedBehaviors: 0 }));
    expect(row.percent).toBe(0);
  });

  it('turns an empty mood into null rather than showing a blank chip', () => {
    expect(normaliseReport(modern({ mostCommonMood: '' })).mood).toBeNull();
    expect(normaliseReport(modern({ mostCommonMood: 'No mood data' })).mood)
      .toBe('No mood data');
  });
});

describe('sortReports', () => {
  it('puts the newest week first', () => {
    const sorted = sortReports([legacy(), modern()]);
    expect(sorted.map((r) => r.weekStart)).toEqual(['2026-09-07', '2026-08-31']);
  });

  it('keeps one row per week, preferring the newest id', () => {
    const old = modern({ id: 5, completionRate: 10 });
    const fresh = modern({ id: 9, completionRate: 90 });
    const sorted = sortReports([old, fresh]);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].id).toBe(9);
  });

  it('leaves the input array alone', () => {
    const input = [legacy(), modern()];
    sortReports(input);
    expect(input[0].weekStart).toBe('2026-08-31');
  });
});

describe('weekOnWeekDelta', () => {
  it('compares each week with the one below it in the list', () => {
    const rows = [modern({ id: 1 }), legacy({ id: 2 })].map(normaliseReport);
    // The earlier row is legacy, so the two answer different questions and
    // there is nothing honest to compare.
    expect(weekOnWeekDelta(rows).get(1)).toBeNull();
  });

  it('gives a signed point difference between two current weeks', () => {
    const rows = [
      modern({ id: 1, plannedEntries: 10, achievedEntries: 8 }),
      modern({ id: 2, weekStart: '2026-08-31', plannedEntries: 10, achievedEntries: 5 }),
    ].map(normaliseReport);
    const delta = weekOnWeekDelta(rows);
    expect(delta.get(1)).toBe(30);
    expect(delta.get(2)).toBeNull();
  });
});

describe('reportWeekLabel', () => {
  it('is empty when a row has no dates rather than printing Invalid Date', () => {
    expect(reportWeekLabel({ weekStart: null, weekEnd: null })).toBe('');
  });

  it('names both ends of the week', () => {
    const label = reportWeekLabel({ weekStart: '2026-09-07', weekEnd: '2026-09-13' });
    expect(label).toMatch(/7/);
    expect(label).toMatch(/13/);
  });
});
