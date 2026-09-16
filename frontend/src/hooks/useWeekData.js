import { useCallback, useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import { addDays, startOfWeek, toIsoDate } from '../pages/dashboardData';

/**
 * Goals plus the entries behind them, from `weeks` before the current week
 * through today. One request pair serves the week grid, the rings, and the streak.
 */
export default function useWeekData(today, weeks = 8) {
  const todayIso = toIsoDate(today);
  const weekStart = useMemo(() => startOfWeek(today), [today]);
  const historyStartIso = toIsoDate(addDays(weekStart, -7 * weeks));

  const [goals, setGoals] = useState([]);
  const [behaviors, setBehaviors] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      client.get('/api/goals'),
      client.get('/api/behaviors/range', { params: { start: historyStartIso, end: todayIso } }),
    ])
      .then(([goalsRes, behaviorsRes]) => {
        if (cancelled) return;
        // A 200 carrying something other than a list (a proxy error page, an
        // error envelope) must not reach the render path as data.
        if (!Array.isArray(goalsRes.data) || !Array.isArray(behaviorsRes.data)) {
          setLoadState('error');
          return;
        }
        setGoals(goalsRes.data);
        setBehaviors(behaviorsRes.data);
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [historyStartIso, todayIso, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const retry = useCallback(() => {
    setLoadState('loading');
    setReloadKey((k) => k + 1);
  }, []);

  return { goals, behaviors, loadState, weekStart, todayIso, reload, retry };
}
