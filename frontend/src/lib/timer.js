/**
 * The time logger's state and formatting. No React, no clock: every function
 * takes the current time as an argument, so the tests do not have to wait.
 *
 * A session is stored as timestamps, never as a running count. Time from
 * finished stretches is kept in `accumulatedMs`; the stretch in progress is
 * `now - resumedAt`. That stays correct through a reload, a closed laptop, or
 * a tab the browser put to sleep, where a counter incremented once a second
 * would lose all of that time.
 *
 *   idle ──start──▶ running ◀──resume── paused
 *                      │ └────pause─────▶  │
 *                      └──────finish───────┴──▶ stopped ──save/discard──▶ idle
 */

export const TIMER_KEY = 'mordi-timer';

/** Longest session the API accepts, mirrored from BehaviorService. */
export const MAX_SECONDS = 7 * 24 * 60 * 60;

export const IDLE = { status: 'idle' };

export function startSession(name, now) {
  return { status: 'running', name: name.trim(), startedAt: now, resumedAt: now, accumulatedMs: 0 };
}

/** Time in the stretch that is running now, never negative. */
const stretch = (session, now) => Math.max(0, now - session.resumedAt);

export function pauseSession(session, now) {
  if (session.status !== 'running') return session;
  return {
    status: 'paused',
    name: session.name,
    startedAt: session.startedAt,
    accumulatedMs: session.accumulatedMs + stretch(session, now),
  };
}

export function resumeSession(session, now) {
  if (session.status !== 'paused') return session;
  return { ...session, status: 'running', resumedAt: now };
}

/** Running or paused, to stopped and waiting to be saved or thrown away. */
export function stopSession(session, now) {
  if (session.status !== 'running' && session.status !== 'paused') return session;
  const accumulatedMs =
    session.status === 'running' ? session.accumulatedMs + stretch(session, now) : session.accumulatedMs;
  return { status: 'stopped', name: session.name, startedAt: session.startedAt, accumulatedMs, stoppedAt: now };
}

/** Whole milliseconds on the clock, never negative. */
export function elapsedMs(session, now) {
  if (session.status === 'idle') return 0;
  if (session.status === 'running') return Math.max(0, session.accumulatedMs + stretch(session, now));
  return Math.max(0, session.accumulatedMs);
}

/** What gets saved: whole seconds, clamped to what the server accepts. */
export function durationSeconds(session, now) {
  return Math.min(MAX_SECONDS, Math.floor(elapsedMs(session, now) / 1000));
}

const isTime = (n) => Number.isFinite(n) && n > 0;
const isSpan = (n) => Number.isFinite(n) && n >= 0;

/**
 * A stored session, or IDLE if what is stored is missing, corrupt, or from a
 * shape this version does not understand. A malformed value must never throw
 * during render.
 *
 * Sessions written before pausing existed ({ running, startedAt } and
 * { stopped, startedAt, stoppedAt }) are still read, so a timer left running
 * across the update keeps its time instead of vanishing.
 */
export function readSession(raw) {
  if (!raw) return IDLE;
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    return IDLE;
  }
  if (!value || typeof value !== 'object') return IDLE;
  const { status, name, startedAt, resumedAt, accumulatedMs, stoppedAt } = value;
  if (typeof name !== 'string' || name.trim().length === 0 || !isTime(startedAt)) return IDLE;

  if (status === 'running') {
    if (resumedAt === undefined && accumulatedMs === undefined) {
      return { status, name, startedAt, resumedAt: startedAt, accumulatedMs: 0 };
    }
    if (isTime(resumedAt) && resumedAt >= startedAt && isSpan(accumulatedMs)) {
      return { status, name, startedAt, resumedAt, accumulatedMs };
    }
    return IDLE;
  }
  if (status === 'paused' && isSpan(accumulatedMs)) {
    return { status, name, startedAt, accumulatedMs };
  }
  if (status === 'stopped' && isTime(stoppedAt) && stoppedAt >= startedAt) {
    if (accumulatedMs === undefined) {
      return { status, name, startedAt, accumulatedMs: stoppedAt - startedAt, stoppedAt };
    }
    if (isSpan(accumulatedMs)) return { status, name, startedAt, accumulatedMs, stoppedAt };
  }
  return IDLE;
}

const pad = (n) => String(n).padStart(2, '0');

/** A stopwatch face: 4:07, 12:30, 1:02:03. Hours appear only once needed. */
export function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** A duration in words for the feed: 45s, 12m, 1h 5m, 2h. */
export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds ?? 0));
  if (total < 60) return `${total}s`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** The same, spelled out for a screen reader: "1 hour 5 minutes". */
export function describeDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds ?? 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const part = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;
  const parts = [];
  if (h) parts.push(part(h, 'hour'));
  if (m) parts.push(part(m, 'minute'));
  if (!h && (s || parts.length === 0)) parts.push(part(s, 'second'));
  return parts.join(' ');
}
