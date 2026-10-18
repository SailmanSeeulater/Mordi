import { useState } from 'react';
import { COLORS } from '../lib/planner';
import { syncedLabel } from '../lib/calendarFeeds';

const MAX_FEEDS = 5;
const errorOf = (err, fallback) => err?.response?.data?.error ?? fallback;

/**
 * Connecting Google Calendars by their secret iCal address, and looking
 * after the ones already connected.
 *
 * With none yet, it is the three steps to find the address in Google
 * Calendar on the web, then the form. With some, it lists them, each with its
 * state and Sync now, Rename and Disconnect, and the form waits behind "Add
 * another calendar". One way only: nothing here changes anything in Google.
 *
 * `feeds` and the four actions come from useCalendarFeeds.
 */
export default function GoogleCalendarDialog({ feeds, connect, update, sync, disconnect, onClose }) {
  const [addingMore, setAdding] = useState(false);
  // With nothing connected (at first, or after disconnecting the last one)
  // the form is the whole dialog.
  const adding = addingMore || feeds.length === 0;

  return (
    <div className="app-form gcal">
      {feeds.length > 0 && (
        <ul className="gcal__feeds" aria-label="Connected calendars">
          {feeds.map((feed) => (
            <FeedRow key={feed.id} feed={feed} update={update} sync={sync} disconnect={disconnect} />
          ))}
        </ul>
      )}

      {adding ? (
        <ConnectForm
          first={feeds.length === 0}
          connect={connect}
          onConnected={() => setAdding(false)}
          onCancel={feeds.length > 0 ? () => setAdding(false) : onClose}
        />
      ) : (
        feeds.length < MAX_FEEDS && (
          <button type="button" className="app-btn app-btn--quiet app-btn--sm gcal__add" onClick={() => setAdding(true)}>
            Add another calendar
          </button>
        )
      )}

      <p className="app-field__hint gcal__note">
        Mordi checks for changes every 15 minutes. Changes made in Google can take a little while to show up in
        Google&rsquo;s own feed.
      </p>
    </div>
  );
}

function ConnectForm({ first, connect, onConnected, onCancel }) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState('sky');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Paste the secret address first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await connect({ url: url.trim(), name: name.trim() || 'Google Calendar', color });
      onConnected();
    } catch (err) {
      setError(errorOf(err, 'Couldn’t connect that calendar. Check your connection and try again.'));
      setBusy(false);
    }
  };

  return (
    <form className="gcal__connect" onSubmit={submit} noValidate>
      {first && (
        <ol className="gcal__steps">
          <li>
            On a computer, open <strong>Google Calendar</strong> at calendar.google.com. Under &ldquo;My
            calendars&rdquo; on the left, point at the calendar, open its <strong>&#8942;</strong> menu and choose
            &ldquo;Settings and sharing&rdquo;.
          </li>
          <li>
            Scroll down to &ldquo;Integrate calendar&rdquo; and copy <strong>Secret address in iCal format</strong>.
          </li>
          <li>Paste it below. Keep it to yourself: anyone with the address can see that calendar.</li>
        </ol>
      )}

      <div className="app-field">
        <label htmlFor="gcal-url">Secret address in iCal format</label>
        <input
          id="gcal-url"
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
          aria-describedby="gcal-url-hint"
        />
        <p className="app-field__hint" id="gcal-url-hint">
          Mordi stores it encrypted and only ever reads from it.
        </p>
      </div>

      <div className="app-field">
        <label htmlFor="gcal-name">Name</label>
        <input
          id="gcal-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Google Calendar"
          maxLength={60}
        />
      </div>

      <ColorChoice id="gcal-color" value={color} onChange={setColor} label="Colour for its events" />

      {error && (
        <p className="app-form__error" role="alert">
          {error}
        </p>
      )}

      <div className="app-form__actions">
        <button type="button" className="app-btn app-btn--ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="app-btn" disabled={busy}>
          {busy ? 'Connecting…' : 'Connect'}
        </button>
      </div>
    </form>
  );
}

function ColorChoice({ id, value, onChange, label }) {
  return (
    <div className="app-field">
      <span className="app-field__label" id={`${id}-label`}>
        {label}
      </span>
      <div className="event-form__colors" role="radiogroup" aria-labelledby={`${id}-label`}>
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            aria-label={c}
            title={c}
            className={`event-swatch ev--${c}`}
            onClick={() => onChange(c)}
          />
        ))}
      </div>
    </div>
  );
}

function FeedRow({ feed, update, sync, disconnect }) {
  const [mode, setMode] = useState(null); // 'rename' | 'disconnect'
  const [name, setName] = useState(feed.name);
  const [color, setColor] = useState(feed.color ?? 'sky');
  const [busy, setBusy] = useState(null); // 'sync' | 'save' | 'disconnect'
  const [error, setError] = useState('');

  const run = async (what, action, fallback) => {
    setBusy(what);
    setError('');
    try {
      await action();
      return true;
    } catch (err) {
      setError(errorOf(err, fallback));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    const ok = await run(
      'save',
      () => update(feed.id, { name: name.trim() || 'Google Calendar', color }),
      'Couldn’t save that. Check your connection and try again.',
    );
    if (ok) setMode(null);
  };

  return (
    <li className={`gcal__feed ev--${feed.color ?? 'sky'}`}>
      <div className="gcal__feed-head">
        <span className="gcal__dot" aria-hidden="true" />
        <div className="gcal__feed-text">
          <strong className="gcal__feed-name">{feed.name}</strong>
          {feed.lastError ? (
            <span className="gcal__feed-state gcal__feed-state--error">{feed.lastError}</span>
          ) : (
            <span className="gcal__feed-state">{syncedLabel(feed)}</span>
          )}
          {feed.addressHint && <span className="gcal__feed-hint">{feed.addressHint}</span>}
        </div>
      </div>

      {mode === null && (
        <div className="gcal__feed-actions">
          <button
            type="button"
            className="app-btn app-btn--quiet app-btn--sm"
            disabled={busy !== null}
            onClick={() => run('sync', () => sync(feed.id), 'Couldn’t sync just now. Try again in a minute.')}
          >
            {busy === 'sync' ? 'Syncing…' : 'Sync now'}
          </button>
          <button type="button" className="app-btn app-btn--quiet app-btn--sm" disabled={busy !== null} onClick={() => setMode('rename')}>
            Rename
          </button>
          <button
            type="button"
            className="app-btn app-btn--quiet app-btn--sm gcal__disconnect"
            disabled={busy !== null}
            onClick={() => setMode('disconnect')}
          >
            Disconnect
          </button>
        </div>
      )}

      {mode === 'rename' && (
        <form className="gcal__rename" onSubmit={save}>
          <div className="app-field">
            <label htmlFor={`gcal-name-${feed.id}`}>Name</label>
            <input
              id={`gcal-name-${feed.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              autoFocus
            />
          </div>
          <ColorChoice id={`gcal-color-${feed.id}`} value={color} onChange={setColor} label="Colour" />
          <div className="app-form__actions">
            <button
              type="button"
              className="app-btn app-btn--ghost app-btn--sm"
              disabled={busy !== null}
              onClick={() => {
                setName(feed.name);
                setColor(feed.color ?? 'sky');
                setMode(null);
              }}
            >
              Cancel
            </button>
            <button type="submit" className="app-btn app-btn--sm" disabled={busy !== null}>
              {busy === 'save' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {mode === 'disconnect' && (
        <div className="gcal__confirm" role="group" aria-label={`Disconnect ${feed.name}`}>
          <p>
            Disconnect {feed.name}? Its events leave Mordi&rsquo;s calendar. Nothing changes in Google.
          </p>
          <div className="app-form__actions">
            <button type="button" className="app-btn app-btn--ghost app-btn--sm" disabled={busy !== null} onClick={() => setMode(null)}>
              Keep it
            </button>
            <button
              type="button"
              className="app-btn app-btn--danger app-btn--sm"
              disabled={busy !== null}
              onClick={() =>
                run('disconnect', () => disconnect(feed.id), 'Couldn’t disconnect it. Check your connection and try again.')
              }
            >
              {busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="app-form__error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
