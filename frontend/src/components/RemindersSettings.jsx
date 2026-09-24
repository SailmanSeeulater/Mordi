import { useEffect, useState } from 'react';
import client from '../api/client';
import Select from './Select';
import { currentSubscription, localTimeZone, pushSupported, subscribe, unsubscribe } from '../lib/push';

const hourLabel = new Intl.DateTimeFormat(undefined, { hour: 'numeric' });
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6).map((h) => ({
  value: String(h),
  label: hourLabel.format(new Date(2000, 0, 1, h)),
}));

/**
 * Reminders, opt-in. Once a day at the hour picked, in the person's own time
 * zone, and only when a goal still has days left this week: "Run: 2 of 4
 * left". Nothing on a week that is already done.
 *
 * Each browser subscribes on its own, so turning reminders on here reaches
 * this device; the hour applies to every device subscribed.
 */
export default function RemindersSettings() {
  const [config, setConfig] = useState(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ tone: 'info', text: '' });

  useEffect(() => {
    let live = true;
    Promise.all([client.get('/api/push/config'), currentSubscription().catch(() => null)])
      .then(([res, sub]) => {
        if (!live) return;
        setConfig(res.data);
        setSubscribed(Boolean(sub));
      })
      .catch(() => {
        if (live) setConfig({ enabled: false, unreachable: true });
      });
    return () => {
      live = false;
    };
  }, []);

  const hour = config?.reminderHour ?? null;
  const on = hour != null && subscribed;

  const setHour = async (next) => {
    const res = await client.put('/api/push/reminder', { hour: next, timeZone: localTimeZone() });
    setConfig(res.data);
  };

  const turnOn = async () => {
    setBusy(true);
    setStatus({ tone: 'info', text: '' });
    try {
      await subscribe(config.publicKey);
      setSubscribed(true);
      await setHour(hour ?? 19);
      setStatus({ tone: 'info', text: 'Reminders are on for this browser.' });
    } catch (err) {
      setStatus({
        tone: 'error',
        text:
          err?.message === 'denied'
            ? 'Notifications are blocked for this site. Allow them in your browser’s site settings, then try again.'
            : 'Couldn’t turn reminders on. Check your connection and try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      await setHour(null);
      await unsubscribe();
      setSubscribed(false);
      setStatus({ tone: 'info', text: 'Reminders are off.' });
    } catch {
      setStatus({ tone: 'error', text: 'Couldn’t turn reminders off. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const res = await client.post('/api/push/test');
      const n = res.data?.sent ?? 0;
      setStatus({
        tone: n ? 'info' : 'error',
        text: n ? `Sent to ${n} ${n === 1 ? 'device' : 'devices'}.` : 'Nothing was delivered. Turn reminders off and on again.',
      });
    } catch {
      setStatus({ tone: 'error', text: 'Couldn’t send a test. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  let body;
  if (!config) {
    body = <p className="settings__note">Checking&hellip;</p>;
  } else if (!config.enabled) {
    body = (
      <p className="settings__note">
        {config.unreachable
          ? 'Couldn’t reach the server to check reminders.'
          : 'Reminders aren’t switched on for this server yet.'}
      </p>
    );
  } else if (!pushSupported()) {
    body = (
      <p className="settings__note">
        This browser can&rsquo;t show reminders. On an iPhone, add Mordi to your home screen first.
      </p>
    );
  } else {
    body = (
      <>
        <p className="settings__note">
          Once a day at the hour you pick, and only when a goal still has days left this week. Nothing on a week
          that&rsquo;s already done. New messages in goals you share arrive here too.
        </p>
        <div className="settings__row">
          <span className="settings__label" id="set-reminder-hour">
            Time
          </span>
          <div className="settings__reminder-hour">
            <Select
              id="reminder-hour"
              labelledBy="set-reminder-hour"
              value={String(hour ?? 19)}
              options={HOURS}
              onChange={(v) => on && setHour(Number(v))}
            />
          </div>
        </div>
        <div className="settings__actions">
          {on ? (
            <>
              <button type="button" className="app-btn app-btn--quiet" onClick={test} disabled={busy}>
                Send a test
              </button>
              <button type="button" className="app-btn app-btn--ghost" onClick={turnOff} disabled={busy}>
                Turn off
              </button>
            </>
          ) : (
            <button type="button" className="app-btn" onClick={turnOn} disabled={busy}>
              {busy ? 'Turning on…' : 'Turn on reminders'}
            </button>
          )}
        </div>
        {config.timeZone && on && (
          <p className="settings__note">Times are in {config.timeZone.replace(/_/g, ' ')}.</p>
        )}
      </>
    );
  }

  return (
    <section className="app-panel" aria-labelledby="set-reminders">
      <div className="app-panel__head">
        <h2 className="app-panel__title" id="set-reminders">
          Reminders
        </h2>
        {on && <span className="app-panel__meta">On</span>}
      </div>
      {body}
      <div role="status">
        {status.text && (
          <p className={'settings__status' + (status.tone === 'error' ? ' settings__status--error' : '')}>
            {status.text}
          </p>
        )}
      </div>
    </section>
  );
}
