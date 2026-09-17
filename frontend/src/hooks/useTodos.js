import { useCallback, useEffect, useRef, useState } from 'react';
import client from '../api/client';

/** Open items first, each group in the order it was added — same as the API. */
export function sortTodos(todos) {
  return [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const byTime = String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''));
    return byTime || String(a.id).localeCompare(String(b.id));
  });
}

/**
 * The caller's to-dos, with changes applied optimistically.
 *
 * Ticking an item off has to feel instant, so the list changes first and the
 * request follows. If the request fails, that one change is undone and the
 * error surfaced.
 *
 * Each action undoes its own change rather than restoring a snapshot of the
 * whole list. A snapshot taken inside a state updater is not reliable — React
 * runs updaters at render time — and with two quick edits in flight, restoring
 * the first one's snapshot would also throw away the second.
 */
export default function useTodos() {
  const [todos, setTodos] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // The latest list, for actions that need to know what they are about to
  // remove. Read only from event handlers, never during render.
  const latest = useRef(todos);
  useEffect(() => {
    latest.current = todos;
  }, [todos]);

  useEffect(() => {
    let cancelled = false;
    client
      .get('/api/todos')
      .then((res) => {
        if (cancelled) return;
        if (!Array.isArray(res.data)) {
          setLoadState('error');
          return;
        }
        setTodos(sortTodos(res.data));
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const retry = useCallback(() => {
    setLoadState('loading');
    setReloadKey((k) => k + 1);
  }, []);

  const run = useCallback(async ({ apply, undo, request, failure }) => {
    setTodos((list) => sortTodos(apply(list)));
    setError('');
    try {
      return await request();
    } catch {
      setTodos((list) => sortTodos(undo(list)));
      setError(failure);
      return null;
    }
  }, []);

  const add = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed) return false;
      // A temporary row, swapped for the saved one when the server answers.
      const temp = {
        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text: trimmed,
        done: false,
        createdAt: new Date().toISOString(),
      };
      const saved = await run({
        apply: (list) => [...list, temp],
        undo: (list) => list.filter((t) => t.id !== temp.id),
        request: () => client.post('/api/todos', { text: trimmed }).then((res) => res.data),
        failure: "Couldn't add that. Check your connection and try again.",
      });
      if (saved) {
        setTodos((list) => sortTodos(list.map((t) => (t.id === temp.id ? saved : t))));
      }
      return Boolean(saved);
    },
    [run],
  );

  const toggle = useCallback(
    (todo) => {
      const flip = (list) => list.map((t) => (t.id === todo.id ? { ...t, done: !t.done } : t));
      return run({
        apply: flip,
        undo: flip,
        request: () => client.put(`/api/todos/${todo.id}`, { done: !todo.done }),
        failure: "Couldn't update that. Check your connection and try again.",
      });
    },
    [run],
  );

  const remove = useCallback(
    (todo) =>
      run({
        apply: (list) => list.filter((t) => t.id !== todo.id),
        undo: (list) => (list.some((t) => t.id === todo.id) ? list : [...list, todo]),
        request: () => client.delete(`/api/todos/${todo.id}`),
        failure: "Couldn't delete that. Check your connection and try again.",
      }),
    [run],
  );

  const clearDone = useCallback(() => {
    const removed = latest.current.filter((t) => t.done);
    const removedIds = new Set(removed.map((t) => t.id));
    return run({
      apply: (list) => list.filter((t) => !removedIds.has(t.id)),
      undo: (list) => [...list, ...removed.filter((t) => !list.some((x) => x.id === t.id))],
      request: () => client.delete('/api/todos/done'),
      failure: "Couldn't clear those. Check your connection and try again.",
    });
  }, [run]);

  return { todos, loadState, error, retry, add, toggle, remove, clearDone };
}
