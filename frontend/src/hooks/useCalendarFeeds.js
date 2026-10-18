import { useCallback, useEffect, useRef, useState } from 'react';
import client from '../api/client';
import { isStale } from '../lib/calendarFeeds';
import { localTimeZone } from '../lib/push';

/**
 * Connected Google Calendars for the calendar page: whether this server can
 * connect them at all, the list, and connect, rename, recolour, sync and
 * disconnect.
 *
 * On opening, every feed the server's timer has not refreshed for fifteen
 * minutes is synced once, in the background; `onSynced` then refetches the
 * events. A 429 (synced a moment ago) or any other failure is left alone: the
 * feed's own state says what happened.
 *
 * The browser's time zone rides along with every connect and sync, so the
 * server converts Google's times into the zone the person is actually in.
 */
export default function useCalendarFeeds({ onSynced } = {}) {
  const [enabled, setEnabled] = useState(false);
  const [feeds, setFeeds] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const caughtUp = useRef(false);
  const onSyncedRef = useRef(onSynced);

  useEffect(() => {
    onSyncedRef.current = onSynced;
  }, [onSynced]);

  const replace = useCallback((feed) => {
    setFeeds((list) => list.map((f) => (f.id === feed.id ? feed : f)));
  }, []);

  const catchUp = useCallback(
    async (list) => {
      const stale = list.filter((f) => isStale(f));
      if (stale.length === 0) return;
      let synced = false;
      for (const feed of stale) {
        try {
          const res = await client.post(`/api/calendar-feeds/${feed.id}/sync`, { timeZone: localTimeZone() });
          if (res?.data) replace(res.data);
          synced = true;
        } catch {
          // 429 or offline: the next visit, or the timer, tries again.
        }
      }
      if (synced) onSyncedRef.current?.();
    },
    [replace],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await client.get('/api/calendar-feeds/config');
        if (cancelled) return;
        if (!config?.data?.enabled) {
          setLoadState('off');
          return;
        }
        setEnabled(true);
        const res = await client.get('/api/calendar-feeds');
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setFeeds(list);
        setLoadState('ready');
        if (!caughtUp.current) {
          caughtUp.current = true;
          catchUp(list);
        }
      } catch {
        if (!cancelled) setLoadState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catchUp]);

  const connect = useCallback(async ({ url, name, color }) => {
    const res = await client.post('/api/calendar-feeds', { url, name, color, timeZone: localTimeZone() });
    setFeeds((list) => [...list, res.data]);
    onSyncedRef.current?.();
    return res.data;
  }, []);

  const update = useCallback(
    async (id, patch) => {
      const res = await client.patch(`/api/calendar-feeds/${id}`, patch);
      replace(res.data);
      if (patch.color) onSyncedRef.current?.();
      return res.data;
    },
    [replace],
  );

  const sync = useCallback(
    async (id) => {
      const res = await client.post(`/api/calendar-feeds/${id}/sync`, { timeZone: localTimeZone() });
      replace(res.data);
      onSyncedRef.current?.();
      return res.data;
    },
    [replace],
  );

  const disconnect = useCallback(async (id) => {
    await client.delete(`/api/calendar-feeds/${id}`);
    setFeeds((list) => list.filter((f) => f.id !== id));
    onSyncedRef.current?.();
  }, []);

  return { enabled, feeds, loadState, connect, update, sync, disconnect };
}
