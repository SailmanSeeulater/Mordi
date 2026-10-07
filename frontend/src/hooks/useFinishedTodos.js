import { useEffect, useState } from 'react';
import client from '../api/client';
import { TODOS_CHANGED } from './useTodos';

/**
 * To-dos finished on the days from startIso to endIso, including ones since
 * cleared from the list. Reloads whenever the to-do list saves a change, so
 * ticking one off on the dashboard puts it in Lately straight away.
 *
 * Supporting data, not the page's own: if it cannot load, the page carries
 * on without it rather than showing an error.
 */
export default function useFinishedTodos(startIso, endIso) {
  const [todos, setTodos] = useState([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(TODOS_CHANGED, bump);
    return () => window.removeEventListener(TODOS_CHANGED, bump);
  }, []);

  useEffect(() => {
    let cancelled = false;
    client
      .get('/api/todos/done', { params: { start: startIso, end: endIso } })
      .then((res) => {
        if (!cancelled) setTodos(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setTodos([]);
      });
    return () => {
      cancelled = true;
    };
  }, [startIso, endIso, version]);

  return todos;
}
