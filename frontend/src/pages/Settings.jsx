import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';
import client from '../api/client';
import AppShell from '../components/AppShell';
import ThemeGrid from '../components/ThemeGrid';
import CustomThemeEditor from '../components/CustomThemeEditor';
import RemindersSettings from '../components/RemindersSettings';
import LayoutSettings from '../components/LayoutSettings';
import ChangePasswordForm from '../components/ChangePasswordForm';
import DeleteAccount from '../components/DeleteAccount';
import { toIsoDate } from './dashboardData';
import { LEGAL } from '../lib/legal';
import { WEEK_STARTS, setWeekStart, useWeekStart } from '../lib/weekStart';
import './settings.css';

// Far enough back to cover any account's history.
const EXPORT_START = '2020-01-01';

const WEEK_START_LABELS = { monday: 'Monday', sunday: 'Sunday' };

/** Monday or Sunday for the calendar's weeks; goal targets are unaffected. */
function WeekStartSetting() {
  const weekStart = useWeekStart();
  return (
    <div className="settings__pref">
      <span className="settings__label" id="set-week-start">
        Week starts on
      </span>
      <div
        className="app-segments settings__pref-segments"
        role="group"
        aria-labelledby="set-week-start"
        aria-describedby="set-week-start-hint"
      >
        <span
          className="app-segments__thumb"
          style={{ '--n': WEEK_STARTS.length, '--i': WEEK_STARTS.indexOf(weekStart) }}
          aria-hidden="true"
        />
        {WEEK_STARTS.map((id) => (
          <button
            key={id}
            type="button"
            className="app-segment"
            aria-pressed={id === weekStart}
            onClick={() => setWeekStart(id)}
          >
            {WEEK_START_LABELS[id]}
          </button>
        ))}
      </div>
      <p className="settings__pref-hint" id="set-week-start-hint">
        Changes the calendar. Weekly goals still count Monday to Sunday.
      </p>
    </div>
  );
}

export default function Settings() {
  useDocumentTitle('Settings');

  const { user, logout } = useAuth();
  const { theme, setTheme, allThemes } = useTheme();
  const navigate = useNavigate();

  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState({ tone: 'info', text: '' });

  const current = allThemes.find((t) => t.id === theme) ?? allThemes[0];

  const exportData = async () => {
    setExporting(true);
    setStatus({ tone: 'info', text: 'Collecting your data…' });
    try {
      const [goals, behaviors, locations] = await Promise.all([
        client.get('/api/goals'),
        client.get('/api/behaviors/range', {
          params: { start: EXPORT_START, end: toIsoDate(new Date()) },
        }),
        client.get('/api/locations').catch(() => ({ data: [] })),
      ]);

      const payload = {
        exportedAt: new Date().toISOString(),
        account: { name: user?.name ?? null, email: user?.email ?? null },
        goals: goals.data,
        entries: behaviors.data,
        places: locations.data,
      };

      const url = URL.createObjectURL(
        new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `mordi-export-${toIsoDate(new Date())}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setStatus({
        tone: 'info',
        text: `Downloaded ${goals.data.length} goals and ${behaviors.data.length} entries.`,
      });
    } catch {
      setStatus({ tone: 'error', text: 'Couldn’t build your export. Try again in a moment.' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppShell title="Settings">
      <div className="settings">
        <LayoutSettings />

        <section className="app-panel" aria-labelledby="set-appearance">
          <div className="app-panel__head">
            <h2 className="app-panel__title" id="set-appearance">
              Appearance
            </h2>
            <div className="app-panel__spacer" />
            <span className="app-panel__meta">{current.label}</span>
          </div>
          <div className="settings__themes">
            <ThemeGrid theme={theme} onPick={setTheme} idPrefix="set-themes" />
          </div>
          <p className="settings__note">
            Twenty-six combinations, sixteen light and ten dark, plus three of your own to mix
            below. Sorbet is the default. Your pick applies across the whole site, landing page
            included, and is saved in this browser only — so another device keeps its own.
          </p>
          <WeekStartSetting />
        </section>

        <CustomThemeEditor />

        <RemindersSettings />

        <section className="app-panel" aria-labelledby="set-account">
          <div className="app-panel__head">
            <h2 className="app-panel__title" id="set-account">
              Account
            </h2>
          </div>
          <div className="settings__row">
            <span className="settings__label">Name</span>
            <span className="settings__value">{user?.name || '—'}</span>
          </div>
          <div className="settings__row">
            <span className="settings__label">Email</span>
            <span className="settings__value">{user?.email || '—'}</span>
          </div>
          <p className="settings__note">
            Changing your name or email isn&rsquo;t available here yet. To change either, write to{' '}
            <a href={`mailto:${LEGAL.contact}`}>{LEGAL.contact}</a>.
          </p>
          <ChangePasswordForm />
        </section>

        <section className="app-panel" aria-labelledby="set-data">
          <div className="app-panel__head">
            <h2 className="app-panel__title" id="set-data">
              Your data
            </h2>
          </div>
          <p className="settings__note">
            Download everything Mordi holds for you — goals, entries and saved places — as one JSON
            file.
          </p>
          <div className="settings__actions">
            <button type="button" className="app-btn" onClick={exportData} disabled={exporting}>
              {exporting ? 'Preparing…' : 'Download my data'}
            </button>
          </div>
          <div role="status">
            {status.text && (
              <p
                className={
                  'settings__status' + (status.tone === 'error' ? ' settings__status--error' : '')
                }
              >
                {status.text}
              </p>
            )}
          </div>
        </section>

        <section className="app-panel" aria-labelledby="set-session">
          <div className="app-panel__head">
            <h2 className="app-panel__title" id="set-session">
              Session
            </h2>
          </div>
          <p className="settings__note">
            Signs you out in this browser only. Everything in your account stays as it is.
          </p>
          <div className="settings__actions">
            <button
              type="button"
              className="app-btn app-btn--danger"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              Log out
            </button>
          </div>
        </section>

        <DeleteAccount />

        <section className="app-panel" aria-labelledby="set-about">
          <div className="app-panel__head">
            <h2 className="app-panel__title" id="set-about">
              About
            </h2>
          </div>
          <div className="settings__links">
            <Link to="/about">About Mordi</Link>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
