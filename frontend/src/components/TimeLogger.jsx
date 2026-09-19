import { useState } from 'react';
import useTimer from '../hooks/useTimer';
import { describeDuration, durationSeconds, elapsedMs, formatClock } from '../lib/timer';
import './timer.css';

const startedFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

const R = 88;
const CIRCUMFERENCE = 2 * Math.PI * R;
const HOUR = 3_600_000;

/**
 * The face: a ring that fills over an hour, with a dot orbiting once a minute,
 * around the digits. Borrowed from the Clock app's timer: one big number, a
 * ring for the sense of progress, nothing else competing with it.
 *
 * The dot's angle is continuous (six degrees per second, never wrapped), so
 * the transition between ticks always turns forwards, including past the top.
 */
function Face({ elapsed, state, name, startedAt }) {
  const minuteFill = (elapsed % HOUR) / HOUR;
  const angle = (elapsed / 1000) * 6;
  return (
    <div className={`clock-face clock-face--${state}`}>
      <svg viewBox="0 0 200 200" className="clock-face__ring" aria-hidden="true" focusable="false">
        <circle className="clock-face__track" cx="100" cy="100" r={R} />
        <circle
          className="clock-face__fill"
          cx="100"
          cy="100"
          r={R}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - minuteFill)}
        />
        {state !== 'idle' && (
          <g className="clock-face__hand" style={{ transform: `rotate(${angle}deg)` }}>
            <circle cx="100" cy={100 - R} r="5" />
          </g>
        )}
      </svg>
      <div className="clock-face__center">
        <p className="clock-face__digits" aria-hidden="true">
          {formatClock(elapsed)}
        </p>
        {state !== 'idle' && <p className="clock-face__label">{name}</p>}
        {state !== 'idle' && (
          <p className="clock-face__meta">Started {startedFormat.format(new Date(startedAt))}</p>
        )}
      </div>
    </div>
  );
}

/**
 * A round button in the Clock app's manner: the label inside, a tinted fill,
 * and a hairline ring with a gap around it. Left is always the quiet action,
 * right is always the one that moves time forward, and each keeps its place
 * as its label changes, so the hand never has to look for it.
 */
function RoundButton({ tone, onClick, disabled, children, label }) {
  return (
    <button
      type="button"
      className={`round-btn round-btn--${tone}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      <span>{children}</span>
    </button>
  );
}

/**
 * Name what you are about to do, start the clock, pause when interrupted,
 * finish when done, then keep the time or throw it away.
 *
 * Deliberately not tied to a goal: this is for keeping track of where time
 * went, not for counting towards a weekly target. A saved session becomes an
 * ordinary entry with a duration, so it shows up in Lately and on the
 * activity grid like anything else logged that day.
 *
 * There is no way to throw a session away while it is on the clock, only once
 * it is finished. A single misplaced tap should not cost three hours.
 */
export default function TimeLogger({ onSaved }) {
  const { session, now, saving, error, start, pause, resume, stop, discard, save } = useTimer();
  const [name, setName] = useState('');

  const elapsed = elapsedMs(session, now);
  const seconds = durationSeconds(session, now);
  const { status } = session;

  const begin = () => {
    if (!name.trim()) return;
    start(name);
    setName('');
  };

  const handleSave = async () => {
    if (await save()) onSaved?.();
  };

  let left;
  let right;
  if (status === 'idle') {
    left = <RoundButton tone="quiet" disabled label="Finish">Finish</RoundButton>;
    right = (
      <RoundButton tone="go" onClick={begin} disabled={!name.trim()} label="Start timer">
        Start
      </RoundButton>
    );
  } else if (status === 'running') {
    left = <RoundButton tone="quiet" onClick={stop} label="Finish timing">Finish</RoundButton>;
    right = <RoundButton tone="pause" onClick={pause} label="Pause timer">Pause</RoundButton>;
  } else if (status === 'paused') {
    left = <RoundButton tone="quiet" onClick={stop} label="Finish timing">Finish</RoundButton>;
    right = <RoundButton tone="go" onClick={resume} label="Resume timer">Resume</RoundButton>;
  } else {
    left = (
      <RoundButton tone="stop" onClick={discard} disabled={saving} label="Discard this time">
        Discard
      </RoundButton>
    );
    right = (
      <RoundButton tone="go" onClick={handleSave} disabled={saving} label="Save to Lately">
        {saving ? '…' : 'Save'}
      </RoundButton>
    );
  }

  return (
    <section className="timer" aria-labelledby="dash-timer-title">
      <div className="app-panel__head">
        <h2 className="app-panel__title" id="dash-timer-title">
          Timer
        </h2>
        <div className="app-panel__spacer" />
        {status === 'running' && (
          <span className="timer__live">
            <span className="timer__dot" aria-hidden="true" />
            Running
          </span>
        )}
        {status === 'paused' && <span className="timer__live timer__live--paused">Paused</span>}
      </div>

      {status === 'idle' && (
        <form
          className="timer__label-row"
          onSubmit={(e) => {
            e.preventDefault();
            begin();
          }}
        >
          <label htmlFor="timer-name">Label</label>
          <input
            id="timer-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What are you timing?"
            maxLength={120}
            autoComplete="off"
            enterKeyHint="go"
          />
        </form>
      )}

      <div className="timer__stage">
        {left}
        <Face elapsed={elapsed} state={status} name={session.name} startedAt={session.startedAt} />
        {right}
      </div>

      <p className="app-sr" role="status">
        {status === 'running' && `Timing ${session.name}.`}
        {status === 'paused' && `Paused at ${describeDuration(seconds)}.`}
        {status === 'stopped' && `Finished at ${describeDuration(seconds)}. Save or discard.`}
      </p>

      {error && (
        <p className="app-form__error timer__error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
