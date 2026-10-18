import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  getWeekStart,
  setWeekStart,
  startOfCalendarWeek,
  useWeekStart,
  weekdayLabels,
  weekdayOrder,
} from '../lib/weekStart';
import { monthGrid, parseIsoDate, startOfWeek, toIsoDate } from '../pages/dashboardData';

const day = (iso) => parseIsoDate(iso);
const iso = (date) => toIsoDate(date);

afterEach(() => localStorage.clear());

describe('startOfCalendarWeek', () => {
  it('goes back to Monday or Sunday from midweek', () => {
    // Thursday, Oct 15 2026.
    expect(iso(startOfCalendarWeek(day('2026-10-15'), 'monday'))).toBe('2026-10-12');
    expect(iso(startOfCalendarWeek(day('2026-10-15'), 'sunday'))).toBe('2026-10-11');
  });

  it('a Sunday ends a Monday week and starts a Sunday one', () => {
    expect(iso(startOfCalendarWeek(day('2026-10-18'), 'monday'))).toBe('2026-10-12');
    expect(iso(startOfCalendarWeek(day('2026-10-18'), 'sunday'))).toBe('2026-10-18');
  });

  it('a Monday starts a Monday week and is the second day of a Sunday one', () => {
    expect(iso(startOfCalendarWeek(day('2026-10-12'), 'monday'))).toBe('2026-10-12');
    expect(iso(startOfCalendarWeek(day('2026-10-12'), 'sunday'))).toBe('2026-10-11');
  });

  it('crosses month and year boundaries', () => {
    // Thursday, Oct 1 2026: the week began in September either way.
    expect(iso(startOfCalendarWeek(day('2026-10-01'), 'monday'))).toBe('2026-09-28');
    expect(iso(startOfCalendarWeek(day('2026-10-01'), 'sunday'))).toBe('2026-09-27');
    // Friday, Jan 1 2027.
    expect(iso(startOfCalendarWeek(day('2027-01-01'), 'monday'))).toBe('2026-12-28');
    expect(iso(startOfCalendarWeek(day('2027-01-01'), 'sunday'))).toBe('2026-12-27');
  });

  it('lands on local midnight across a daylight-saving change', () => {
    // Nov 1 2026 is when US clocks go back; Mar 29 2026 when Europe's go
    // forward. Whatever zone the test runs in, the result is a midnight on
    // the right date, never 23:00 the day before.
    for (const [from, weekStart, want] of [
      ['2026-11-03', 'sunday', '2026-11-01'],
      ['2026-11-03', 'monday', '2026-11-02'],
      ['2026-11-07', 'sunday', '2026-11-01'],
      ['2026-03-31', 'monday', '2026-03-30'],
      ['2026-04-01', 'sunday', '2026-03-29'],
    ]) {
      const start = startOfCalendarWeek(new Date(`${from}T15:45:00`), weekStart);
      expect(iso(start)).toBe(want);
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
    }
  });

  it('defaults to Monday, matching weekly targets', () => {
    expect(iso(startOfCalendarWeek(day('2026-10-15')))).toBe(iso(startOfWeek(day('2026-10-15'))));
  });
});

describe('weekday order', () => {
  it('lists the seven days from the chosen start', () => {
    expect(weekdayOrder('monday')).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(weekdayOrder('sunday')).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(weekdayLabels('monday')[0]).toBe('Mon');
    expect(weekdayLabels('sunday')).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  });
});

describe('monthGrid with a week start', () => {
  it('leads the six weeks with the chosen day', () => {
    for (const month of ['2026-02-01', '2026-10-17', '2026-11-01']) {
      expect(monthGrid(day(month), 'sunday')[0].date.getDay()).toBe(0);
      expect(monthGrid(day(month), 'monday')[0].date.getDay()).toBe(1);
    }
  });

  it('starts on the 1st itself when the month opens on that day', () => {
    // November 2026 opens on a Sunday.
    expect(monthGrid(day('2026-11-01'), 'sunday')[0].iso).toBe('2026-11-01');
    expect(monthGrid(day('2026-11-01'), 'monday')[0].iso).toBe('2026-10-26');
  });

  it('still covers every day of the month once', () => {
    const inside = monthGrid(day('2026-10-01'), 'sunday').filter((d) => !d.outside);
    expect(inside).toHaveLength(31);
    expect(inside[0].iso).toBe('2026-10-01');
  });
});

describe('the stored preference', () => {
  it('is Sunday until set, and remembers Monday', () => {
    expect(getWeekStart()).toBe('sunday');
    setWeekStart('monday');
    expect(getWeekStart()).toBe('monday');
    expect(localStorage.getItem('mordi-week-start')).toBe('monday');
  });

  it('ignores anything that is not a known day', () => {
    localStorage.setItem('mordi-week-start', 'wednesday');
    expect(getWeekStart()).toBe('sunday');
    setWeekStart('friday');
    expect(localStorage.getItem('mordi-week-start')).toBe('wednesday');
  });

  it('tells every reader when it changes', () => {
    const { result } = renderHook(() => useWeekStart());
    expect(result.current).toBe('sunday');
    act(() => setWeekStart('monday'));
    expect(result.current).toBe('monday');
  });

  it('still works for the session when storage is blocked', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      expect(getWeekStart()).toBe('sunday');
      setWeekStart('monday');
      expect(getWeekStart()).toBe('monday');
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
  });
});
