import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useToday from '../hooks/useToday';
import { toIsoDate } from '../pages/dashboardData';

describe('useToday', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rolls over to the next day at local midnight', () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 14, 23, 59, 30) });
    const { result } = renderHook(() => useToday());
    expect(toIsoDate(result.current)).toBe('2026-09-14');

    act(() => {
      vi.advanceTimersByTime(45_000);
    });

    expect(toIsoDate(result.current)).toBe('2026-09-15');
  });

  it('catches up when the tab regains focus after the timer was missed', () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 14, 22, 0) });
    const { result } = renderHook(() => useToday());

    // Simulate a sleeping laptop: the clock jumps without timers firing.
    vi.setSystemTime(new Date(2026, 8, 15, 7, 0));
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(toIsoDate(result.current)).toBe('2026-09-15');
  });

  it('keeps the same Date object within a day so memoized values stay stable', () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 14, 9, 0) });
    const { result } = renderHook(() => useToday());
    const first = result.current;

    vi.setSystemTime(new Date(2026, 8, 14, 15, 0));
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(result.current).toBe(first);
  });
});
