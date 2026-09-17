import { describe, expect, it } from 'vitest';
import {
  IDLE,
  MAX_SECONDS,
  describeDuration,
  durationSeconds,
  elapsedMs,
  formatClock,
  formatDuration,
  readSession,
  startSession,
  stopSession,
} from '../lib/timer';

const T0 = 1_790_000_000_000;

describe('a session', () => {
  it('starts running with a trimmed name and its start time', () => {
    expect(startSession('  Deep work  ', T0)).toEqual({
      status: 'running',
      name: 'Deep work',
      startedAt: T0,
    });
  });

  it('measures from the start time, not from a running count', () => {
    const running = startSession('Read', T0);
    expect(elapsedMs(running, T0 + 90_000)).toBe(90_000);
    // Hours later, as after a closed laptop, the answer is still exact.
    expect(elapsedMs(running, T0 + 3 * 3_600_000)).toBe(3 * 3_600_000);
  });

  it('freezes when stopped, however much later it is read', () => {
    const stopped = stopSession(startSession('Read', T0), T0 + 60_000);
    expect(stopped.status).toBe('stopped');
    expect(elapsedMs(stopped, T0 + 999_999_999)).toBe(60_000);
  });

  it('ignores a stop on anything that is not running', () => {
    expect(stopSession(IDLE, T0)).toBe(IDLE);
    const stopped = stopSession(startSession('Read', T0), T0 + 1000);
    expect(stopSession(stopped, T0 + 5000)).toBe(stopped);
  });

  it('never reports negative time if the clock moves backwards', () => {
    expect(elapsedMs(startSession('Read', T0), T0 - 5000)).toBe(0);
  });

  it('is zero when idle', () => {
    expect(elapsedMs(IDLE, T0)).toBe(0);
    expect(durationSeconds(IDLE, T0)).toBe(0);
  });
});

describe('durationSeconds', () => {
  it('saves whole seconds, rounding down', () => {
    const stopped = stopSession(startSession('Read', T0), T0 + 61_999);
    expect(durationSeconds(stopped, T0)).toBe(61);
  });

  it('clamps a runaway session to what the server accepts', () => {
    const stopped = stopSession(startSession('Oops', T0), T0 + (MAX_SECONDS + 3600) * 1000);
    expect(durationSeconds(stopped, T0)).toBe(MAX_SECONDS);
  });
});

describe('readSession', () => {
  it('restores a running session', () => {
    const raw = JSON.stringify({ status: 'running', name: 'Deep work', startedAt: T0 });
    expect(readSession(raw)).toEqual({ status: 'running', name: 'Deep work', startedAt: T0 });
  });

  it('restores a stopped session awaiting save', () => {
    const raw = JSON.stringify({ status: 'stopped', name: 'Read', startedAt: T0, stoppedAt: T0 + 5000 });
    expect(readSession(raw).status).toBe('stopped');
  });

  it('drops extra fields rather than carrying them into state', () => {
    const raw = JSON.stringify({ status: 'running', name: 'Read', startedAt: T0, injected: '<b>' });
    expect(readSession(raw)).not.toHaveProperty('injected');
  });

  it('falls back to idle for anything missing, corrupt or malformed', () => {
    expect(readSession(null)).toBe(IDLE);
    expect(readSession('')).toBe(IDLE);
    expect(readSession('{not json')).toBe(IDLE);
    expect(readSession('"a string"')).toBe(IDLE);
    expect(readSession('null')).toBe(IDLE);
    expect(readSession(JSON.stringify({ status: 'running', name: '', startedAt: T0 }))).toBe(IDLE);
    expect(readSession(JSON.stringify({ status: 'running', name: 'Read' }))).toBe(IDLE);
    expect(readSession(JSON.stringify({ status: 'running', name: 'Read', startedAt: 'yesterday' }))).toBe(IDLE);
    expect(readSession(JSON.stringify({ status: 'paused', name: 'Read', startedAt: T0 }))).toBe(IDLE);
  });

  it('rejects a stopped session that ends before it began', () => {
    const raw = JSON.stringify({ status: 'stopped', name: 'Read', startedAt: T0, stoppedAt: T0 - 1 });
    expect(readSession(raw)).toBe(IDLE);
  });
});

describe('formatting', () => {
  it('shows a stopwatch face, with hours only once needed', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(7_000)).toBe('0:07');
    expect(formatClock(247_000)).toBe('4:07');
    expect(formatClock(3_723_000)).toBe('1:02:03');
    expect(formatClock(-5)).toBe('0:00');
  });

  it('writes a duration compactly for the feed', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(60)).toBe('1m');
    expect(formatDuration(725)).toBe('12m');
    expect(formatDuration(3900)).toBe('1h 5m');
    expect(formatDuration(7200)).toBe('2h');
    expect(formatDuration(null)).toBe('0s');
  });

  it('spells a duration out for a screen reader', () => {
    expect(describeDuration(1)).toBe('1 second');
    expect(describeDuration(0)).toBe('0 seconds');
    expect(describeDuration(125)).toBe('2 minutes 5 seconds');
    expect(describeDuration(3660)).toBe('1 hour 1 minute');
    expect(describeDuration(7200)).toBe('2 hours');
  });
});
