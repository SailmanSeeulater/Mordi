import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useCountUp from '../hooks/useCountUp';

/** Runs a whole animation frame by frame, collecting what was shown. */
function play(result, ms = 500) {
  const frames = [];
  for (let t = 0; t < ms; t += 16) {
    act(() => {
      vi.advanceTimersByTime(16);
    });
    frames.push(result.current[0]);
  }
  return frames;
}

describe('useCountUp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows the first value as it is, with no count and no pop', () => {
    const { result } = renderHook(({ value }) => useCountUp(value), {
      initialProps: { value: 7 },
    });

    expect(result.current).toEqual([7, false]);
    // Nothing moves on a page that was merely opened.
    expect(new Set(play(result))).toEqual(new Set([7]));
    expect(result.current).toEqual([7, false]);
  });

  it('counts to the new value after a change, and settles on it exactly', () => {
    const { result, rerender } = renderHook(({ value }) => useCountUp(value), {
      initialProps: { value: 8 },
    });

    rerender({ value: 9 });
    expect(result.current[1]).toBe(true);

    const frames = play(result);
    expect(frames.some((n) => n === 8)).toBe(true);
    expect(result.current).toEqual([9, false]);
  });

  it('counts the whole way when the value jumps by more than one', () => {
    const { result, rerender } = renderHook(({ value }) => useCountUp(value), {
      initialProps: { value: 0 },
    });

    rerender({ value: 12 });
    const frames = play(result);

    // Somewhere between the two, rather than a jump from 0 to 12.
    expect(frames.some((n) => n > 0 && n < 12)).toBe(true);
    // Never past the target, and settled on it.
    expect(Math.max(...frames)).toBe(12);
    expect(result.current).toEqual([12, false]);
  });

  it('retargets a run already in flight without going backwards to its start', () => {
    const { result, rerender } = renderHook(({ value }) => useCountUp(value), {
      initialProps: { value: 0 },
    });

    rerender({ value: 10 });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    const midway = result.current[0];
    expect(midway).toBeGreaterThan(0);

    rerender({ value: 11 });
    const frames = play(result);
    expect(Math.min(...frames)).toBeGreaterThanOrEqual(midway);
    expect(result.current).toEqual([11, false]);
  });

  it('updates straight to the value under reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));

    const { result, rerender } = renderHook(({ value }) => useCountUp(value), {
      initialProps: { value: 2 },
    });

    rerender({ value: 9 });
    expect(result.current).toEqual([9, false]);
  });
});
