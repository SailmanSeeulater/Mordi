import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import Modal from './Modal';
import { parseIsoDate, toIsoDate } from '../pages/dashboardData';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

/** The moment a to-do left the list: when it was removed, else when it was done. */
function leftAt(todo) {
  return todo.removedAt ?? todo.completedAt ?? null;
}

/**
 * The day it sits under. A finished one keeps the person's own day it was
 * ticked off on, as Lately does; a removed one takes the day it was removed,
 * in this browser's zone.
 */
function historyDay(todo) {
  if (todo.removedAt) return toIsoDate(new Date(todo.removedAt));
  return todo.completedOn ?? (todo.completedAt ? toIsoDate(new Date(todo.completedAt)) : null);
}

function dayLabel(iso, todayIso) {
  if (iso === todayIso) return 'Today';
  const date = parseIsoDate(iso);
  const label = `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
  return iso.slice(0, 4) === todayIso.slice(0, 4) ? label : `${label}, ${date.getFullYear()}`;
}

function timeOf(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : clock.format(d);
}

/** Newest first in, newest first out: runs of the same day become one group. */
function groupByDay(todos) {
  const groups = [];
  for (const todo of todos) {
    const iso = historyDay(todo) ?? '';
    const last = groups[groups.length - 1];
    if (last && last.iso === iso) last.todos.push(todo);
    else groups.push({ iso, todos: [todo] });
  }
  return groups;
}

const tick = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

const cross = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
    strokeLinecap="round" aria-hidden="true" focusable="false">
    <path d="M7 7l10 10M17 7L7 17" />
  </svg>
);

/**
 * To-dos someone finished or removed, newest first and grouped by day, a
 * page at a time. Removing one from the list keeps it here; deleting it here
 * is what erases it.
 */
export default function TodoHistory() {
  const [todos, setTodos] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadState, setLoadState] = useState('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);

  const fetchPage = useCallback(async (n) => {
    const res = await client.get('/api/todos/history', { params: { page: n } });
    const items = Array.isArray(res.data?.items) ? res.data.items : null;
    if (!items) throw new Error('Unexpected answer');
    return { items, more: Boolean(res.data.hasMore) };
  }, []);

  const load = useCallback(async () => {
    try {
      const { items, more } = await fetchPage(0);
      setTodos(items);
      setPage(0);
      setHasMore(more);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, [fetchPage]);

  useEffect(() => {
    // Async: state is only set once the request answers.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const retry = () => {
    setLoadState('loading');
    load();
  };

  const showOlder = async () => {
    setLoadingMore(true);
    setError('');
    try {
      const { items, more } = await fetchPage(page + 1);
      // A delete since the last page shifts the rest up a row; skip any the
      // list already has rather than showing one twice.
      setTodos((list) => [...list, ...items.filter((t) => !list.some((x) => x.id === t.id))]);
      setPage((p) => p + 1);
      setHasMore(more);
    } catch {
      setError('Couldn’t load older to-dos. Check your connection and try again.');
    } finally {
      setLoadingMore(false);
    }
  };

  const erase = async (todo) => {
    setBusy(true);
    setError('');
    try {
      await client.delete(`/api/todos/${todo.id}/history`);
      setTodos((list) => list.filter((t) => t.id !== todo.id));
      setConfirming(null);
    } catch {
      setError(`Couldn’t delete “${todo.text}”. Check your connection and try again.`);
    } finally {
      setBusy(false);
    }
  };

  const todayIso = toIsoDate(new Date());

  return (
    <>
      {loadState === 'loading' && <p className="app-empty">Loading your to-dos…</p>}

      {loadState === 'error' && (
        <div className="app-empty">
          <p>Couldn&rsquo;t load your to-dos.</p>
          <button type="button" className="app-btn app-btn--quiet" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {loadState === 'ready' && todos.length === 0 && (
        <div className="app-panel history__empty">
          <h2 className="app-panel__title">No to-dos here yet</h2>
          <p>
            To-dos you tick off or remove land here, newest first, so you can look back on what
            got done and what you let go of.
          </p>
        </div>
      )}

      {error && (
        <p className="app-form__error" role="alert">
          {error}
        </p>
      )}

      {loadState === 'ready' && todos.length > 0 && (
        <div className="app-panel todo-history">
          <ul className="todo-history__days">
            {groupByDay(todos).map((group) => (
              <li key={group.iso} className="todo-history__day">
                <p className="todo-history__date">{group.iso ? dayLabel(group.iso, todayIso) : 'Undated'}</p>
                <ul className="todo-history__items">
                  {group.todos.map((todo) => {
                    const removed = Boolean(todo.removedAt);
                    const time = timeOf(leftAt(todo));
                    const what = removed ? (todo.done ? 'Done, then removed' : 'Removed') : 'Done';
                    return (
                      <li key={todo.id} className={`todo-history__item${removed ? ' todo-history__item--removed' : ''}`}>
                        <span className="todo-history__mark">{removed ? cross : tick}</span>
                        <div className="todo-history__body">
                          <p className="todo-history__text">{todo.text}</p>
                          <p className="todo-history__meta">
                            {what}
                            {time && (
                              <>
                                {' · '}
                                <time dateTime={leftAt(todo)}>{time}</time>
                              </>
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="todo-history__delete app-linkbtn"
                          onClick={() => setConfirming(todo)}
                          aria-label={`Delete ${todo.text} from History`}
                        >
                          Delete
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
          {hasMore && (
            <button type="button" className="app-btn app-btn--quiet app-btn--sm todo-history__more"
              onClick={showOlder} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Show older'}
            </button>
          )}
        </div>
      )}

      {confirming && (
        <Modal title="Delete to-do" onClose={() => setConfirming(null)}>
          <p className="history__confirm">
            Delete &ldquo;{confirming.text}&rdquo; for good?
            <span>It leaves History and can&rsquo;t be brought back.</span>
          </p>
          <div className="app-form">
            <div className="app-form__actions">
              <button type="button" className="app-btn app-btn--ghost" onClick={() => setConfirming(null)}>
                Keep it
              </button>
              <button
                type="button"
                className="app-btn app-btn--danger"
                onClick={() => erase(confirming)}
                disabled={busy}
              >
                Delete to-do
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
