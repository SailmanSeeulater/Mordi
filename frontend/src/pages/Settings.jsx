import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';
import { THEMES } from '../context/theme-context-value';
import client from '../api/client';
import AppShell from '../components/AppShell';
import ThemeGrid from '../components/ThemeGrid';
import RemindersSettings from '../components/RemindersSettings';
import { toIsoDate } from './dashboardData';
import './settings.css';

// Far enough back to cover any account's history.
const EXPORT_START = '2020-01-01';

export default function Settings() {
  useDocumentTitle('Settings');

  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState({ tone: 'info', text: '' });

  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0];

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
      setStatus({ tone: 'error', text: "Couldn't build your export. Try again in a moment." });
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppShell title="Settings">
      <div className="settings">
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
            Twenty-five combinations, sixteen light and nine dark. Sorbet is the default. Your
            pick applies across the whole site, landing page included, and is saved in this
            browser only — so another device keeps its own.
          </p>
        </section>

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
            Changing your name or email isn&rsquo;t supported yet — the API has no endpoint for it.
          </p>
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
            Signing out clears your token from this browser. Your data stays on the server.
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

        <section className="app-panel" aria-labelledby="set-about">
          <div className="app-panel__head">
            <h2 className="app-panel__title" id="set-about">
              About
            </h2>
          </div>
          <div className="settings__links">
            <Link to="/about">About Mordi</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
