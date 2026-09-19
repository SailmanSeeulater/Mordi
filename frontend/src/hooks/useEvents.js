import { useCallback, useEffect, useRef, useState } from 'react';
import client from '../api/client';
import { addDays, isoDate } from '../lib/planner';

/**
 * Planned events for `days` days from `start`, with create, update and remove.
 *
 * Updates are optimistic: a dragged event lands where it was dropped at once,
 * and snaps back (by reloading) only if the server refuses. A response that
 * arrives after the view has moved to another week is ignored, so paging
 * quickly never paints last week's events onto this one.
 */
export default function useEvents(start, days) {
  const startIso = isoDate(start);
  const endIso = isoDate(addDays(start, days - 1));
  const [events, setEvents] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const latest = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++latest.current;
    try {
      const res = await client.get('/api/events', { params: { start: startIso, end: endIso } });
      if (ticket !== latest.current) return;
      setEvents(Array.isArray(res.data) ? res.data : []);
      setLoadState('ready');
    } catch {
      if (ticket === latest.current) setLoadState('error');
    }
  }, [startIso, endIso]);

  useEffect(() => {
    // Async: state is only set once the request answers.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const create = useCallback(async (body) => {
    const res = await client.post('/api/events', body);
    setEvents((list) => [...list, res.data]);
    return res.data;
  }, []);

  const update = useCallback(
    async (id, patch) => {
      setEvents((list) => list.map((e) => (e.id === id ? { ...e, ...patch } : e)));
      try {
        const res = await client.put(`/api/events/${id}`, patch);
        setEvents((list) => list.map((e) => (e.id === id ? res.data : e)));
        return res.data;
      } catch (err) {
        load();
        throw err;
      }
    },
    [load],
  );

  const remove = useCallback(async (id) => {
    await client.delete(`/api/events/${id}`);
    setEvents((list) => list.filter((e) => e.id !== id));
  }, []);

  return { events, loadState, reload: load, create, update, remove };
}
