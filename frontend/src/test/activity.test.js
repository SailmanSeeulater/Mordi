import { describe, expect, it } from 'vitest';
import {
  LEVELS,
  SCALE_FLOOR,
  buildHeatmap,
  countByDay,
  describeDay,
  levelFor,
} from '../lib/activity';
import { groupByDay } from '../lib/feed';
import { parseIsoDate } from '../pages/dashboardData';

// A Thursday, so the current week column is only partly in the past.
const TODAY = new Date(2026, 8, 17);

const entry = (logDate, id = logDate) => ({ id, logDate });

describe('countByDay', () => {
  it('counts every log against its day', () => {
    const counts = countByDay([entry('2026-09-16', 1), entry('2026-09-16', 2), entry('2026-09-15', 3)]);
    expect(counts.get('2026-09-16')).toBe(2);
    expect(counts.get('2026-09-15')).toBe(1);
  });

  it('ignores entries with no date rather than counting them somewhere', () => {
    const counts = countByDay([{ id: 1 }, null, entry('2026-09-16')]);
    expect([...counts.values()]).toEqual([1]);
  });

  it('reads the day from a timestamp as well as a bare date', () => {
    expect(countByDay([entry('2026-09-16T08:30:00')]).get('2026-09-16')).toBe(1);
  });
});

describe('levelFor', () => {
  it('is zero only when nothing was logged', () => {
    expect(levelFor(0, 4)).toBe(0);
    expect(levelFor(undefined, 4)).toBe(0);
  });

  it('maps small counts straight to a step while under the floor', () => {
    expect([1, 2, 3, 4].map((n) => levelFor(n, SCALE_FLOOR))).toEqual([1, 2, 3, 4]);
  });

  it('caps at the darkest step', () => {
    expect(levelFor(40, SCALE_FLOOR)).toBe(LEVELS);
  });

  it('never lets a day with a log disappear, however busy the busiest day was', () => {
    expect(levelFor(1, 100)).toBe(1);
  });

  it('gets more saturated as the count rises', () => {
    const levels = [1, 5, 10, 15, 20].map((n) => levelFor(n, 20));
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
    expect(levels[0]).toBeLessThan(levels[4]);
  });
});

describe('buildHeatmap', () => {
  it('lays out whole Monday-to-Sunday weeks ending with this week', () => {
    const map = buildHeatmap(new Map(), TODAY, 53);
    expect(map.columns).toHaveLength(53);
    expect(map.columns.every((days) => days.length === 7)).toBe(true);
    // parseIsoDate, not new Date(iso): a bare ISO date parses as UTC midnight,
    // which is still the previous day west of Greenwich.
    expect(parseIsoDate(map.columns[0][0].iso).getDay()).toBe(1);
    expect(map.columns[52].map((d) => d.iso)).toContain('2026-09-17');
  });

  it('marks the rest of this week as future and never counts it', () => {
    const counts = new Map([['2026-09-19', 5]]);
    const map = buildHeatmap(counts, TODAY, 2);
    const saturday = map.columns[1].find((d) => d.iso === '2026-09-19');
    expect(saturday.future).toBe(true);
    expect(saturday.level).toBe(0);
    expect(map.total).toBe(0);
  });

  it('treats today as past, not future', () => {
    const map = buildHeatmap(new Map([['2026-09-17', 1]]), TODAY, 1);
    const today = map.columns[0].find((d) => d.iso === '2026-09-17');
    expect(today.future).toBe(false);
    expect(today.level).toBe(1);
  });

  it('shades by count: more logs, a darker day', () => {
    const counts = new Map([
      ['2026-09-14', 1],
      ['2026-09-15', 2],
      ['2026-09-16', 4],
    ]);
    const days = buildHeatmap(counts, TODAY, 1).columns[0];
    const level = (iso) => days.find((d) => d.iso === iso).level;
    expect(level('2026-09-14')).toBeLessThan(level('2026-09-15'));
    expect(level('2026-09-15')).toBeLessThan(level('2026-09-16'));
  });

  it('does not paint a sparse history at full strength', () => {
    // A new account whose busiest day has one log.
    const map = buildHeatmap(new Map([['2026-09-16', 1]]), TODAY, 4);
    expect(map.scale).toBe(SCALE_FLOOR);
    expect(map.busiest).toEqual({ iso: '2026-09-16', count: 1 });
    const logged = map.columns.flat().find((d) => d.count === 1);
    expect(logged.level).toBe(1);
  });

  it('rescales against a heavy logger’s own busiest day', () => {
    const map = buildHeatmap(
      new Map([
        ['2026-09-15', 12],
        ['2026-09-16', 3],
      ]),
      TODAY,
      1,
    );
    expect(map.scale).toBe(12);
    const days = map.columns[0];
    expect(days.find((d) => d.iso === '2026-09-15').level).toBe(LEVELS);
    expect(days.find((d) => d.iso === '2026-09-16').level).toBe(1);
  });

  it('totals logs and active days inside the window only', () => {
    const counts = new Map([
      ['2026-09-16', 2],
      ['2026-09-15', 1],
      ['2020-01-01', 99],
    ]);
    const map = buildHeatmap(counts, TODAY, 2);
    expect(map.total).toBe(3);
    expect(map.activeDays).toBe(2);
  });

  it('labels each new month once, and never two labels crowded together', () => {
    const map = buildHeatmap(new Map(), TODAY, 53);
    const cols = map.months.map((m) => m.col);
    expect(new Set(map.months.map((m) => m.label)).size).toBeGreaterThanOrEqual(11);
    cols.slice(1).forEach((c, i) => expect(c - cols[i]).toBeGreaterThanOrEqual(3));
  });
});

describe('describeDay', () => {
  it('reads naturally for none, one and many', () => {
    expect(describeDay({ iso: '2026-09-16', count: 0 })).toBe('No logs on Wed, Sep 16');
    expect(describeDay({ iso: '2026-09-16', count: 1 })).toBe('1 log on Wed, Sep 16');
    expect(describeDay({ iso: '2026-09-16', count: 3 })).toBe('3 logs on Wed, Sep 16');
  });
});

describe('groupByDay', () => {
  it('groups consecutive entries from the same day and keeps their order', () => {
    const groups = groupByDay([
      entry('2026-09-17', 'a'),
      entry('2026-09-17', 'b'),
      entry('2026-09-16', 'c'),
      entry('2026-09-14', 'd'),
    ]);
    expect(groups.map((g) => g.iso)).toEqual(['2026-09-17', '2026-09-16', '2026-09-14']);
    expect(groups[0].entries.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('splits where the day changes even if a day comes back later', () => {
    const groups = groupByDay([entry('2026-09-17', 'a'), entry('2026-09-16', 'b'), entry('2026-09-17', 'c')]);
    expect(groups).toHaveLength(3);
  });

  it('is empty for nothing, and skips entries with no date', () => {
    expect(groupByDay([])).toEqual([]);
    expect(groupByDay([{ id: 1 }, null])).toEqual([]);
  });
});
