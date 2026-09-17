import { useState } from 'react';
import useTimer from '../hooks/useTimer';
import { describeDuration, durationSeconds, elapsedMs, formatClock } from '../lib/timer';
import './timer.css';

const startedFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

const IconPlay = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M8 5.5v13l11-6.5z" />
  </svg>
);

const IconStop = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    <rect x="5" y="5" width="14" height="14" rx="2" />
  </svg>
);

/**
 * Name what you are about to do, start the clock, stop it when you are done,
 * and keep the time or throw it away.
 *
 * Deliberately not tied to a goal: this is for keeping track of where time
 * went, not for counting towards a weekly target. A saved session becomes an
 * ordinary entry with a duration, so it shows up in Lately and on the
 * activity grid like anything else logged that day.
 *
 * There is no way to discard a timer while it is running, only after stopping
 * it. A single misplaced tap should not be able to throw away three hours.
 */
export default function TimeLogger({ onSaved }) {
  const { session, now, saving, error, start, stop, discard, save } = useTimer();
  const [name, setName] = useState('');

  const elapsed = elapsedMs(session, now);
  const seconds = durationSeconds(session, now);

  const submitStart = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    start(name);
    setName('');
  };

  const handleSave = async () => {
    if (await save()) onSaved?.();
  };

  return (
    <section className="app-panel timer" aria-labelledby="dash-timer-title">
      <div className="app-panel__head">
        <h2 className="app-panel__title" id="dash-timer-title">
          Time logger
        </h2>
        <div className="app-panel__spacer" />
        {session.status === 'running' && (
          <span className="timer__live">
            <span className="timer__dot" aria-hidden="true" />
            Running
          </span>
        )}
      </div>

      {session.status === 'idle' && (
        <form className="timer__start" onSubmit={submitStart}>
          <label className="app-sr" htmlFor="timer-name">
            What are you timing?
          </label>
          <input
            id="timer-name"
            className="timer__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What are you timing?"
            maxLength={120}
            autoComplete="off"
            enterKeyHint="go"
          />
          <button type="submit" className="app-btn app-btn--sm" disabled={!name.trim()}>
            <IconPlay />
            Start
          </button>
        </form>
      )}

      {session.status !== 'idle' && (
        <div className="timer__session">
          <div className="timer__readout">
            <p className="timer__name">{session.name}</p>
            <p className="timer__clock" aria-hidden="true">
              {formatClock(elapsed)}
            </p>
            <p className="timer__meta">
              Started {startedFormat.format(new Date(session.startedAt))}
            </p>
          </div>

          {session.status === 'running' ? (
            <div className="timer__actions">
              <span className="app-sr">Timer running for {session.name}.</span>
              <button type="button" className="app-btn" onClick={stop}>
                <IconStop />
                Stop
              </button>
            </div>
          ) : (
            <div className="timer__actions">
              <p className="app-sr" role="status">
                Stopped at {describeDuration(seconds)}.
              </p>
              <button type="button" className="app-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save to Lately'}
              </button>
              <button
                type="button"
                className="app-btn app-btn--ghost"
                onClick={discard}
                disabled={saving}
              >
                Discard
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="app-form__error timer__error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
