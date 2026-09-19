import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import { toIsoDate } from '../pages/dashboardData';
import {
  IDLE,
  TIMER_KEY,
  durationSeconds,
  pauseSession,
  readSession,
  resumeSession,
  startSession,
  stopSession,
} from '../lib/timer';

function load() {
  try {
    return readSession(localStorage.getItem(TIMER_KEY));
  } catch {
    return IDLE;
  }
}

function store(session) {
  try {
    if (session.status === 'idle') localStorage.removeItem(TIMER_KEY);
    else localStorage.setItem(TIMER_KEY, JSON.stringify(session));
  } catch {
    // Private windows throw. The timer still works; it just will not survive
    // a reload.
  }
}

/**
 * The time logger: idle, running, paused, or stopped and waiting to be saved.
 *
 * The session lives in localStorage, so a timer keeps running across a
 * reload, a move to another page, or the laptop lid. Another open tab picks up
 * a start or stop through the storage event, so two tabs never show two
 * different timers.
 *
 * `now` only drives the display. Elapsed time is always computed from the
 * stored timestamps, so a throttled background tab cannot make it drift.
 */
export default function useTimer() {
  const [session, setSession] = useState(load);
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    store(session);
  }, [session]);

  // A quarter-second tick, so the seconds digit turns over crisply rather
  // than up to a second late. Only while running.
  useEffect(() => {
    if (session.status !== 'running') return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [session.status]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === TIMER_KEY) setSession(readSession(e.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const start = useCallback((name) => {
    if (!name.trim()) return;
    const at = Date.now();
    setError('');
    setNow(at);
    setSession(startSession(name, at));
  }, []);

  const pause = useCallback(() => {
    const at = Date.now();
    setNow(at);
    setSession((current) => pauseSession(current, at));
  }, []);

  const resume = useCallback(() => {
    const at = Date.now();
    setNow(at);
    setSession((current) => resumeSession(current, at));
  }, []);

  const stop = useCallback(() => {
    const at = Date.now();
    setNow(at);
    setSession((current) => stopSession(current, at));
  }, []);

  const discard = useCallback(() => {
    setError('');
    setSession(IDLE);
  }, []);

  /**
   * Saves the session as an entry, dated the day it started, so a timer run
   * past midnight still belongs to the evening it began. Resolves true on
   * success; on failure the session stays stopped so saving can be retried.
   */
  const save = useCallback(async () => {
    if (session.status !== 'stopped') return false;
    setSaving(true);
    setError('');
    try {
      await client.post('/api/behaviors', {
        goalId: null,
        note: session.name,
        mood: null,
        completed: true,
        logDate: toIsoDate(new Date(session.startedAt)),
        durationSeconds: durationSeconds(session, Date.now()),
        // When the work began, so the time of day on the entry is the start
        // of the session rather than the moment Save was pressed.
        loggedAt: new Date(session.startedAt).toISOString(),
      });
      setSession(IDLE);
      return true;
    } catch {
      setError("Couldn't save that time. Check your connection and try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [session]);

  return { session, now, saving, error, start, pause, resume, stop, discard, save };
}
