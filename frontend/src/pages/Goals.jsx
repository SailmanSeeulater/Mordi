import { useCallback, useMemo, useState } from 'react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import useToday from '../hooks/useToday';
import useWeekData from '../hooks/useWeekData';
import client from '../api/client';
import AppShell from '../components/AppShell';
import Modal from '../components/Modal';
import GoalForm from '../components/GoalForm';
import { targetLabel, weekSummary } from './dashboardData';
import './goals.css';

const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');

// Matches the dashboard deck, so a goal's field is the same on both pages.
const TINTS = ['7%', '12%', '17%', '22%'];

export default function Goals() {
  useDocumentTitle('Goals');

  const today = useToday();
  const { goals, behaviors, loadState, weekStart, todayIso, reload, retry } = useWeekData(today);

  const [modal, setModal] = useState(null); // 'add' | 'edit' | 'archive'
  const [active, setActive] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState('');

  const summary = useMemo(
    () => weekSummary(goals, behaviors, weekStart, today),
    [goals, behaviors, weekStart, today],
  );
  const todayColumn = summary.days.indexOf(todayIso);

  const closeModal = useCallback(() => {
    setModal(null);
    setActive(null);
    setArchiveError('');
  }, []);

  const handleSaved = useCallback(() => {
    closeModal();
    reload();
  }, [closeModal, reload]);

  const archiveGoal = async () => {
    setArchiving(true);
    setArchiveError('');
    try {
      await client.delete(`/api/goals/${active.id}`);
      setArchiving(false);
      handleSaved();
    } catch {
      setArchiving(false);
      setArchiveError("Couldn't archive that goal. Check your connection and try again.");
    }
  };

  const planned = summary.rows.reduce((sum, r) => sum + r.target, 0);
  const achieved = summary.rows.reduce((sum, r) => sum + Math.min(r.done, r.target), 0);

  return (
    <AppShell
      title="Goals"
      action={
        loadState === 'ready' && goals.length > 0 ? (
          <button
            type="button"
            className="app-btn app-btn--sm"
            onClick={() => {
              setActive(null);
              setModal('add');
            }}
          >
            Add goal
          </button>
        ) : null
      }
    >
      {loadState === 'loading' && (
        <p className="app-status" role="status">
          Loading your goals…
        </p>
      )}

      {loadState === 'error' && (
        <div className="app-status" role="alert">
          <span>Couldn&rsquo;t load your goals.</span>
          <button type="button" className="app-btn app-btn--quiet" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {loadState === 'ready' && goals.length === 0 && (
        <section className="onboard" aria-labelledby="goals-empty-title">
          <h2 className="onboard__title" id="goals-empty-title">
            No goals yet.
          </h2>
          <p className="onboard__body">
            A goal is a thing you want to do a certain number of days each week. Set the target and
            Mordi keeps the count.
          </p>
          <div className="onboard__actions">
            <button type="button" className="app-btn" onClick={() => setModal('add')}>
              Add your first goal
            </button>
          </div>
        </section>
      )}

      {loadState === 'ready' && goals.length > 0 && (
        <div className="goals">
          <p className="goals__summary">
            <span>
              <strong>{goals.length}</strong> {goals.length === 1 ? 'goal' : 'goals'}
            </span>
            <span>
              <strong>
                {achieved}/{planned}
              </strong>{' '}
              planned entries this week
            </span>
          </p>

          {summary.rows.map((row, i) => {
            const percent = Math.min(row.done / row.target, 1) * 100;
            return (
              <article
                className="goal-card"
                key={row.goal.id}
                style={{ '--tint': TINTS[i % TINTS.length] }}
              >
                <span className="goal-card__mark" aria-hidden="true">
                  {row.goal.title.trim()[0]?.toUpperCase() ?? 'M'}
                </span>

                <span
                  className={`app-ring goal-card__ring${row.done === 0 ? ' app-ring--empty' : ''}`}
                  style={{ '--ring-p': percent }}
                  aria-hidden="true"
                >
                  <span className="app-ring__inner goal-card__ring-inner">
                    {row.done}/{row.target}
                  </span>
                </span>

                <h2 className="goal-card__name">{row.goal.title}</h2>

                <div className="goal-card__actions">
                  <button
                    type="button"
                    className="app-btn app-btn--quiet app-btn--sm"
                    onClick={() => {
                      setActive(row.goal);
                      setModal('edit');
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="app-btn app-btn--ghost app-btn--sm"
                    onClick={() => {
                      setActive(row.goal);
                      setModal('archive');
                    }}
                  >
                    Archive
                  </button>
                </div>

                <div className="goal-card__meta">
                  {row.goal.category && (
                    <span className="goal-card__tag">{capitalize(row.goal.category)}</span>
                  )}
                  <span>{targetLabel(row.goal)}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {row.done} of {row.target} this week
                  </span>
                </div>

                <div className="goal-card__week" aria-hidden="true">
                  {row.statuses.map((status, i) => (
                    <span
                      key={i}
                      className={
                        'week-dot' +
                        (status === 'done' ? ' week-dot--done' : '') +
                        (status === 'missed' ? ' week-dot--missed' : '') +
                        (i === todayColumn ? ' week-dot--today' : '')
                      }
                    />
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {modal === 'add' && (
        <Modal title="Add a goal" onClose={closeModal}>
          <GoalForm onSaved={handleSaved} onCancel={closeModal} />
        </Modal>
      )}

      {modal === 'edit' && active && (
        <Modal title="Edit goal" onClose={closeModal}>
          <GoalForm goal={active} onSaved={handleSaved} onCancel={closeModal} />
        </Modal>
      )}

      {modal === 'archive' && active && (
        <Modal title="Archive goal" onClose={closeModal}>
          <p className="goals__confirm">
            Archive &ldquo;{active.title}&rdquo;?
            <span>
              It stops appearing on your dashboard. Entries you already logged against it stay as
              they are.
            </span>
          </p>
          <div className="app-form">
            {archiveError && (
              <p className="app-form__error" role="alert">
                {archiveError}
              </p>
            )}
            <div className="app-form__actions">
              <button type="button" className="app-btn app-btn--ghost" onClick={closeModal}>
                Keep it
              </button>
              <button
                type="button"
                className="app-btn app-btn--danger"
                onClick={archiveGoal}
                disabled={archiving}
              >
                {archiving ? 'Archiving…' : 'Archive goal'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
