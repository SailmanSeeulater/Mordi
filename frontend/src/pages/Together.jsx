import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import client from '../api/client';
import AppShell from '../components/AppShell';
import Modal from '../components/Modal';
import ShareGoalDialog from '../components/ShareGoalDialog';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { addDays, startOfWeek, toIsoDate } from './dashboardData';
import { MAX_MESSAGE, initials, sharedGoals, sinceLabel, togetherApi, togetherLabel } from '../lib/together';
import './together.css';

/** How often an open thread checks for new messages. No websockets: a goal's
 *  thread is a few messages a day, and a poll survives any proxy. */
const POLL_MS = 12000;
const dayLetter = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' });
const fullTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function useVisible() {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}

export default function Together() {
  const { goalId: param } = useParams();
  const goalId = param ? Number(param) : null;
  const navigate = useNavigate();
  const visible = useVisible();

  const [goals, setGoals] = useState(null);
  const [loadError, setLoadError] = useState(false);

  const loadGoals = useCallback(async () => {
    try {
      const res = await client.get('/api/goals');
      setGoals(Array.isArray(res.data) ? res.data : []);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadGoals();
  }, [loadGoals]);

  // Unread counts on the list stay fresh while the page is open.
  useEffect(() => {
    if (!visible) return undefined;
    const id = setInterval(loadGoals, POLL_MS * 2);
    return () => clearInterval(id);
  }, [visible, loadGoals]);

  const shared = useMemo(() => (goals ? sharedGoals(goals) : []), [goals]);
  const current = goals?.find((g) => g.id === goalId) ?? null;

  // With room for both columns, an empty "pick one" pane is a wasted step:
  // open the goal with something unread, or else the first. Phones keep the
  // list as the index, since there it is the whole screen.
  useEffect(() => {
    if (goalId || shared.length === 0) return;
    if (!window.matchMedia?.('(min-width: 861px)').matches) return;
    const pick = shared.find((g) => g.unread > 0) ?? shared[0];
    navigate(`/together/${pick.id}`, { replace: true });
  }, [goalId, shared, navigate]);

  useDocumentTitle(current ? `${current.title} · Together` : 'Together');

  const markRead = useCallback((id) => {
    setGoals((list) => list?.map((g) => (g.id === id ? { ...g, unread: 0 } : g)) ?? list);
  }, []);

  return (
    <AppShell title="Together">
      {loadError && !goals && (
        <div className="app-status" role="alert">
          <span>Couldn&rsquo;t load your shared goals.</span>
          <button type="button" className="app-btn app-btn--quiet" onClick={loadGoals}>
            Try again
          </button>
        </div>
      )}
      {!goals && !loadError && (
        <p className="app-status" role="status">
          Loading&hellip;
        </p>
      )}

      {goals && shared.length === 0 && !current && (
        <section className="onboard app-glass" aria-labelledby="together-empty">
          <h2 className="onboard__title" id="together-empty">
            Nothing shared yet.
          </h2>
          <p className="onboard__body">
            Share a goal with a friend and you each log it yourselves, see each other&rsquo;s week, and talk about it
            here. They see which days you did it, never your notes, moods or places.
          </p>
          <div className="onboard__actions">
            <Link className="app-btn" to="/goals">
              Share a goal
            </Link>
          </div>
        </section>
      )}

      {goals && (shared.length > 0 || current) && (
        <div className={`together${goalId ? ' together--open' : ''}`}>
          <nav className="together__list app-panel" aria-label="Shared goals">
            <ul>
              {shared.map((g) => (
                <li key={g.id}>
                  <Link
                    to={`/together/${g.id}`}
                    className="together__item"
                    aria-current={g.id === goalId ? 'page' : undefined}
                  >
                    <span className="together__item-title">{g.title}</span>
                    <span className="together__item-meta">{togetherLabel(g)}</span>
                    {g.unread > 0 && g.id !== goalId && (
                      <span className="together__unread" aria-label={`${g.unread} unread`}>
                        {g.unread > 99 ? '99+' : g.unread}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {goalId && !current && (
            <section className="together__room app-panel">
              <p className="app-empty">
                This goal isn&rsquo;t here any more. It may have ended, or you may have left it.{' '}
                <Link to="/together">Back to Together</Link>
              </p>
            </section>
          )}
          {current && (
            <Room
              key={current.id}
              goal={current}
              visible={visible}
              onRead={markRead}
              onChanged={loadGoals}
              onLeft={() => {
                loadGoals();
                navigate('/together');
              }}
            />
          )}
          {!goalId && (
            <section className="together__room together__room--idle app-panel">
              <p className="app-empty">Pick a goal to see the week and the thread.</p>
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}

function Room({ goal, visible, onRead, onChanged, onLeft }) {
  const owner = goal.role === 'owner';
  const [week, setWeek] = useState(null);
  const [messages, setMessages] = useState(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const logRef = useRef(null);
  const stickRef = useRef(true);
  const firstLoadRef = useRef(true);
  // Ids already on screen when the room opened; anything later rises in.
  const [arrived, setArrived] = useState(null);

  const monday = useMemo(() => startOfWeek(new Date()), []);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday]);
  const todayIndex = (new Date().getDay() + 6) % 7;

  const loadWeek = useCallback(async () => {
    try {
      const res = await togetherApi.week(goal.id, toIsoDate(monday));
      setWeek(res.data);
    } catch {
      setError('Couldn’t load this week.');
    }
  }, [goal.id, monday]);

  // The newest page, merged over what is already shown so older pages that
  // were loaded stay put.
  const loadNewest = useCallback(async () => {
    try {
      const res = await togetherApi.messages(goal.id);
      setMessages((prev) => {
        const incoming = res.data.messages;
        if (!prev) return incoming;
        const byId = new Map(prev.map((m) => [m.id, m]));
        for (const m of incoming) byId.set(m.id, m);
        // Dropped from the newest page because they were deleted elsewhere.
        const newestIds = new Set(incoming.map((m) => m.id));
        const floor = incoming[0]?.id ?? Infinity;
        return [...byId.values()]
          .filter((m) => m.id < floor || newestIds.has(m.id))
          .sort((a, b) => a.id - b.id);
      });
      // Whether older pages exist is known from the first load; later polls
      // only bring newer messages.
      if (firstLoadRef.current) {
        firstLoadRef.current = false;
        setMore(res.data.more);
        setArrived(new Set(res.data.messages.map((m) => m.id)));
      }
      onRead(goal.id);
    } catch {
      setError('Couldn’t load messages.');
    }
  }, [goal.id, onRead]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadWeek();
    loadNewest();
  }, [loadWeek, loadNewest]);

  useEffect(() => {
    if (!visible) return undefined;
    const id = setInterval(() => {
      loadNewest();
      loadWeek();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [visible, loadNewest, loadWeek]);

  // Follow new messages only when already at the bottom; never yank someone
  // who scrolled up to read.
  useLayoutEffect(() => {
    const log = logRef.current;
    if (log && stickRef.current) log.scrollTop = log.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const log = logRef.current;
    stickRef.current = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  };

  const loadOlder = async () => {
    if (!messages?.length) return;
    const log = logRef.current;
    const before = log.scrollHeight;
    try {
      const res = await togetherApi.messages(goal.id, messages[0].id);
      stickRef.current = false;
      // Older history is not news: it arrives without the rise.
      setArrived((prev) => new Set([...(prev ?? []), ...res.data.messages.map((m) => m.id)]));
      setMessages((prev) => [...res.data.messages, ...prev]);
      setMore(res.data.more);
      requestAnimationFrame(() => {
        log.scrollTop += log.scrollHeight - before;
      });
    } catch {
      setError('Couldn’t load older messages.');
    }
  };

  const remove = async (message) => {
    try {
      await togetherApi.deleteMessage(goal.id, message.id);
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
    } catch {
      setError('Couldn’t delete that message.');
    }
  };

  const alone = (week?.members.length ?? goal.memberCount) < 2;

  return (
    <section className="together__room app-panel" aria-labelledby="room-title">
      <header className="room__head">
        <Link className="room__back app-linkbtn" to="/together">
          All shared goals
        </Link>
        <div className="room__heading">
          <h2 className="app-panel__title" id="room-title">
            {goal.title}
          </h2>
          <span className="app-panel__meta">{togetherLabel(goal)}</span>
        </div>
        <div className="room__actions">
          {owner ? (
            <button type="button" className="app-btn app-btn--quiet app-btn--sm" onClick={() => setSharing(true)}>
              Invite &amp; people
            </button>
          ) : (
            <button type="button" className="app-btn app-btn--ghost app-btn--sm" onClick={() => setLeaving(true)}>
              Leave
            </button>
          )}
        </div>
      </header>

      <div className="room__week" role="table" aria-label="This week">
        <div className="room__row room__row--head" role="row">
          <span role="columnheader" className="room__who">
            This week
          </span>
          {days.map((d, i) => (
            <span
              key={i}
              role="columnheader"
              className={`room__day${i === todayIndex ? ' room__day--today' : ''}`}
              aria-label={d.toLocaleDateString(undefined, { weekday: 'long' })}
            >
              {dayLetter.format(d)}
            </span>
          ))}
          <span role="columnheader" className="room__score">
            Done
          </span>
        </div>
        {week?.members.map((person) => (
          <div className="room__row" role="row" key={person.id}>
            <span role="rowheader" className="room__who">
              <span className="together-avatar" aria-hidden="true">
                {initials(person.name)}
              </span>
              <span className="app-trunc">{person.you ? 'You' : person.name}</span>
            </span>
            {person.days.map((done, i) => (
              <span
                key={i}
                role="cell"
                className={`room__cell${done ? ' room__cell--done' : ''}${i === todayIndex ? ' room__cell--today' : ''}`}
                aria-label={done ? 'Done' : 'Not done'}
              />
            ))}
            <span role="cell" className="room__score">
              {person.done}/{week.targetPerWeek}
            </span>
          </div>
        ))}
        {!week && <p className="room__loading">Loading the week&hellip;</p>}
      </div>

      <div className="room__thread">
        <div className="room__log" ref={logRef} onScroll={onScroll} role="log" aria-label="Messages">
          {more && (
            <button type="button" className="app-linkbtn room__older" onClick={loadOlder}>
              Show older messages
            </button>
          )}
          {messages?.length === 0 && (
            <p className="room__quiet">
              {alone
                ? 'Invite someone to start the thread.'
                : 'No messages yet. Say how the week is going, or cheer someone on.'}
            </p>
          )}
          {messages?.map((m, i) => {
            const prev = messages[i - 1];
            // Consecutive messages from one person within five minutes read as one.
            const grouped =
              prev && prev.authorId === m.authorId && new Date(m.createdAt) - new Date(prev.createdAt) < 5 * 60000;
            const fresh = arrived && !arrived.has(m.id);
            return (
              // tabIndex -1: a tap focuses the message, which is what shows
              // its Delete on a touch screen; it stays out of the Tab order.
              <article
                key={m.id}
                tabIndex={-1}
                className={`msg${m.you ? ' msg--you' : ''}${grouped ? ' msg--grouped' : ''}${fresh ? ' msg--new' : ''}`}
              >
                {!grouped && (
                  <header className="msg__head">
                    <span className="together-avatar together-avatar--sm" aria-hidden="true">
                      {initials(m.authorName)}
                    </span>
                    <span className="msg__name">{m.you ? 'You' : m.authorName}</span>
                    <time className="msg__time" dateTime={m.createdAt} title={fullTime.format(new Date(m.createdAt))}>
                      {sinceLabel(m.createdAt)}
                    </time>
                  </header>
                )}
                <p className="msg__body">{m.body}</p>
                {(m.you || owner) && (
                  <button
                    type="button"
                    className="msg__delete app-linkbtn"
                    onClick={() => remove(m)}
                    aria-label={m.you ? 'Delete your message' : `Delete ${m.authorName}’s message`}
                  >
                    Delete
                  </button>
                )}
              </article>
            );
          })}
        </div>

        {error && (
          <p className="app-form__error room__error" role="alert">
            {error}{' '}
            <button type="button" className="app-linkbtn" onClick={() => setError('')}>
              Dismiss
            </button>
          </p>
        )}

        <Composer
          goalId={goal.id}
          disabled={alone}
          onSent={(message) => {
            stickRef.current = true;
            setMessages((prev) => [...(prev ?? []), message]);
          }}
          onError={setError}
        />
      </div>

      {sharing && (
        <ShareGoalDialog
          goal={goal}
          onClose={() => {
            setSharing(false);
            loadWeek();
            onChanged();
          }}
          onChanged={onChanged}
        />
      )}

      {leaving && <LeaveDialog goal={goal} onClose={() => setLeaving(false)} onLeft={onLeft} />}
    </section>
  );
}

function Composer({ goalId, disabled, onSent, onError }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const fieldRef = useRef(null);
  const left = MAX_MESSAGE - text.length;

  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight + 3, 168)}px`;
  }, [text]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending || left < 0) return;
    setSending(true);
    try {
      const res = await togetherApi.post(goalId, body);
      setText('');
      onSent(res.data);
    } catch (err) {
      onError(err?.response?.data?.error ?? 'Couldn’t send that. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      className="room__composer"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <label htmlFor={`composer-${goalId}`} className="app-sr">
        Message
      </label>
      <textarea
        ref={fieldRef}
        id={`composer-${goalId}`}
        rows={1}
        value={text}
        maxLength={MAX_MESSAGE + 50}
        placeholder={disabled ? 'Invite someone first' : 'Write a message'}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Enter sends; Shift+Enter is a new line. Not while composing
          // characters in an input method.
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
      />
      <div className="room__send">
        {left < 60 && (
          <span className={`room__left${left < 0 ? ' room__left--over' : ''}`} aria-live="polite">
            {left}
          </span>
        )}
        <button type="submit" className="app-btn app-btn--sm" disabled={disabled || sending || !text.trim() || left < 0}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </form>
  );
}

function LeaveDialog({ goal, onClose, onLeft }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const leave = async () => {
    setBusy(true);
    try {
      await togetherApi.leave(goal.id);
      onLeft();
    } catch {
      setBusy(false);
      setError('Couldn’t leave. Try again.');
    }
  };
  return (
    <Modal title="Leave this goal" onClose={onClose}>
      <p className="together__confirm">
        Leave &ldquo;{goal.title}&rdquo;?
        <span>
          It leaves your dashboard and you stop seeing the thread. Everything you logged stays yours, in your own
          history. You&rsquo;d need a new invite to come back.
        </span>
      </p>
      <div className="app-form">
        {error && (
          <p className="app-form__error" role="alert">
            {error}
          </p>
        )}
        <div className="app-form__actions">
          <button type="button" className="app-btn app-btn--ghost" onClick={onClose}>
            Stay
          </button>
          <button type="button" className="app-btn" onClick={leave} disabled={busy}>
            {busy ? 'Leaving…' : 'Leave goal'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
