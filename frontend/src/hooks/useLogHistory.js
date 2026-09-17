import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import { addDays, startOfWeek, toIsoDate } from '../pages/dashboardData';

/**
 * Every entry from the first day the activity grid shows through today.
 *
 * Separate from useWeekData, which only reaches back eight weeks: the grid
 * covers a year, and the rest of the dashboard should not wait on a year of
 * rows to draw the current week.
 */
export default function useLogHistory(today, weeks, reloadKey = 0) {
  const todayIso = toIsoDate(today);
  const startIso = toIsoDate(addDays(startOfWeek(today), -7 * (weeks - 1)));

  const [entries, setEntries] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    client
      .get('/api/behaviors/range', { params: { start: startIso, end: todayIso } })
      .then((res) => {
        if (cancelled) return;
        if (!Array.isArray(res.data)) {
          setLoadState('error');
          return;
        }
        setEntries(res.data);
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [startIso, todayIso, reloadKey, retryKey]);

  const retry = useCallback(() => {
    setLoadState('loading');
    setRetryKey((k) => k + 1);
  }, []);

  return { entries, loadState, retry };
}
