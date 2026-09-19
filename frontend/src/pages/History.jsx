import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import AppShell from '../components/AppShell';
import Modal from '../components/Modal';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { CATEGORY_ICONS } from '../lib/categories';
import { parseIsoDate } from './dashboardData';
import './history.css';

const dayFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');

/** "Mar 1, 2026 – Jun 30, 2026", or one date when both ends are the same day. */
function span(first, last) {
  if (!first) return null;
  const a = dayFormat.format(parseIsoDate(first));
  const b = dayFormat.format(parseIsoDate(last));
  return a === b ? a : `${a} – ${b}`;
}

/**
 * Goals someone has finished with. Archiving takes a goal off the dashboard
 * without losing what was logged against it; this is where it goes, with a
 * short account of what it amounted to, and a way back.
 */
export default function History() {
  useDocumentTitle('History');
  const [goals, setGoals] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [confirming, setConfirming] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await client.get('/api/goals/archived');
      setGoals(res.data ?? []);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    // Async: state is only set once the request answers.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const act = async (goal, request, failure) => {
    setBusyId(goal.id);
    setActionError('');
    try {
      await request();
      setGoals((list) => list.filter((g) => g.id !== goal.id));
      setConfirming(null);
    } catch {
      setActionError(failure);
    } finally {
      setBusyId(null);
    }
  };

  const restore = (goal) =>
    act(goal, () => client.post(`/api/goals/${goal.id}/restore`),
      `Couldn't restore “${goal.title}”. Check your connection and try again.`);

  const remove = (goal) =>
    act(goal, () => client.delete(`/api/goals/${goal.id}`),
      `Couldn't delete “${goal.title}”. Check your connection and try again.`);

  return (
    <AppShell title="History">
      {loadState === 'loading' && <p className="app-empty">Loading your history…</p>}

      {loadState === 'error' && (
        <div className="app-empty">
          <p>Couldn&rsquo;t load your history.</p>
          <button type="button" className="app-btn app-btn--quiet" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {loadState === 'ready' && goals.length === 0 && (
        <div className="app-panel history__empty">
          <h2 className="app-panel__title">Nothing archived yet</h2>
          <p>
            When you finish with a goal, archive it from the Goals page. It lands here with
            everything you logged against it, and you can bring it back whenever you like.
          </p>
        </div>
      )}

      {actionError && (
        <p className="app-form__error" role="alert">
          {actionError}
        </p>
      )}

      {loadState === 'ready' && goals.length > 0 && (
        <ul className="history">
          {goals.map((goal) => {
            const rate = goal.entries ? Math.round((goal.completed / goal.entries) * 100) : null;
            const ran = span(goal.firstLog, goal.lastLog);
            return (
              <li key={goal.id} className="app-panel history__item">
                <div className="history__head">
                  <h2 className="history__title">{goal.title}</h2>
                  <span className="history__archived">
                    Archived {dayFormat.format(new Date(goal.archivedAt))}
                  </span>
                </div>

                <div className="history__meta">
                  {goal.category && (
                    <span className="history__tag">
                      {CATEGORY_ICONS[goal.category] ?? null}
                      {capitalize(goal.category)}
                    </span>
                  )}
                  <span>{goal.targetPerWeek === 7 ? 'Every day' : `${goal.targetPerWeek}× a week`}</span>
                  {goal.placeName && <span className="app-trunc">{goal.placeName}</span>}
                </div>

                <dl className="history__stats">
                  <div>
                    <dt>Entries</dt>
                    <dd>{goal.entries}</dd>
                  </div>
                  <div>
                    <dt>Completed</dt>
                    <dd>{rate === null ? '—' : `${rate}%`}</dd>
                  </div>
                  <div className="history__ran">
                    <dt>Logged</dt>
                    <dd>{ran ?? 'Nothing logged'}</dd>
                  </div>
                </dl>

                <div className="history__actions">
                  <button
                    type="button"
                    className="app-btn app-btn--sm"
                    onClick={() => restore(goal)}
                    disabled={busyId === goal.id}
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    className="app-btn app-btn--ghost app-btn--sm"
                    onClick={() => setConfirming(goal)}
                    disabled={busyId === goal.id}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {confirming && (
        <Modal title="Delete goal" onClose={() => setConfirming(null)}>
          <p className="goals__confirm">
            Delete &ldquo;{confirming.title}&rdquo; for good?
            <span>It leaves History and can&rsquo;t be restored. Entries you logged stay in your feed.</span>
          </p>
          <div className="app-form">
            <div className="app-form__actions">
              <button type="button" className="app-btn app-btn--ghost" onClick={() => setConfirming(null)}>
                Keep it
              </button>
              <button
                type="button"
                className="app-btn app-btn--danger"
                onClick={() => remove(confirming)}
                disabled={busyId === confirming.id}
              >
                Delete goal
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
