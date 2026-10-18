import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';

const NONE = [];

/**
 * Goals, and the entries logged against them from `startIso` to `endIso`,
 * for the calendar to draw planned goals on their days. Entries are only
 * asked for up to today: nothing can be logged later than that.
 *
 * Quiet on failure: the calendar is about events, and without this it just
 * shows no goal chips, as it did before goals had days.
 */
export default function usePlannedGoals(startIso, endIso, todayIso) {
  const [goals, setGoals] = useState([]);
  const [behaviors, setBehaviors] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);
  const lastIso = endIso < todayIso ? endIso : todayIso;

  useEffect(() => {
    let cancelled = false;
    client
      .get('/api/goals')
      .then((res) => {
        if (!cancelled && Array.isArray(res.data)) setGoals(res.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;
    // A range wholly in the future has nothing logged in it to ask for.
    if (startIso > lastIso) return undefined;
    client
      .get('/api/behaviors/range', { params: { start: startIso, end: lastIso } })
      .then((res) => {
        if (!cancelled && Array.isArray(res.data)) setBehaviors(res.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [startIso, lastIso, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  return { goals, behaviors: startIso > lastIso ? NONE : behaviors, reload };
}
