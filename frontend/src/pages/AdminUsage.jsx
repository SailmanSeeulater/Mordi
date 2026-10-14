import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import client from '../api/client';
import AppShell from '../components/AppShell';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { parseIsoDate } from './dashboardData';
import './admin-usage.css';

const dayFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const number = new Intl.NumberFormat();

/** "3 of 20 (15%)", or a dash when nobody signed up in the cohort's window. */
function retention(stats) {
  if (!stats.cohortSize) return '—';
  const pct = Math.round((stats.cohortRetained / stats.cohortSize) * 100);
  return `${number.format(stats.cohortRetained)} of ${number.format(stats.cohortSize)} (${pct}%)`;
}

const COLUMNS = [
  ['Active', 'activeUsers'],
  ['Weekly', 'weeklyActiveUsers'],
  ['Monthly', 'monthlyActiveUsers'],
  ['New', 'newUsers'],
  ['Entries', 'entriesLogged'],
  ['To-dos done', 'todosDone'],
  ['Goals created', 'goalsCreated'],
];

/**
 * How many people use Mordi and how often, as counts. Not linked from
 * anywhere: whoever runs Mordi types the address. The server answers 404 to
 * anyone else, and so does this page, by treating it as any other address
 * that is not here.
 */
export default function AdminUsage() {
  useDocumentTitle('Usage');
  const [usage, setUsage] = useState(null);
  const [loadState, setLoadState] = useState('loading');

  const load = useCallback(async () => {
    try {
      const res = await client.get('/api/admin/stats');
      setUsage(res.data);
      setLoadState('ready');
    } catch (err) {
      setLoadState(err?.response?.status === 404 ? 'missing' : 'error');
    }
  }, []);

  useEffect(() => {
    // Async: state is only set once the request answers.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // The same thing an unknown address does anywhere in the app.
  if (loadState === 'missing') return <Navigate to="/" replace />;

  const today = usage?.today;
  const days = usage?.days ?? [];

  return (
    <AppShell title="Usage">
      {loadState === 'loading' && (
        <p className="app-status" role="status">
          Counting&hellip;
        </p>
      )}

      {loadState === 'error' && (
        <div className="app-status" role="alert">
          <span>Couldn&rsquo;t load the numbers.</span>
          <button type="button" className="app-btn app-btn--quiet" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {loadState === 'ready' && today && (
        <div className="usage">
          <section className="app-card usage__today" aria-labelledby="usage-today-title">
            <header className="usage__head">
              <h2 id="usage-today-title" className="usage__title">
                Today so far
              </h2>
              <p className="usage__meta">{dayFormat.format(parseIsoDate(today.day))}, counted in UTC</p>
            </header>
            <dl className="usage__facts">
              <div>
                <dt>Active today</dt>
                <dd>{number.format(today.activeUsers)}</dd>
              </div>
              <div>
                <dt>Active this week</dt>
                <dd>{number.format(today.weeklyActiveUsers)}</dd>
              </div>
              <div>
                <dt>Active this month</dt>
                <dd>{number.format(today.monthlyActiveUsers)}</dd>
              </div>
              <div>
                <dt>Total accounts</dt>
                <dd>{number.format(today.totalUsers)}</dd>
              </div>
              <div>
                <dt>4-week retention</dt>
                <dd>{retention(today)}</dd>
              </div>
            </dl>
          </section>

          <section className="app-card usage__days" aria-labelledby="usage-days-title">
            <header className="usage__head">
              <h2 id="usage-days-title" className="usage__title">
                Last 90 days
              </h2>
              <p className="usage__meta">One row a day, newest first</p>
            </header>
            {days.length === 0 ? (
              <p className="usage__empty">
                The first daily snapshot is taken at 23:55 UTC. Today&rsquo;s live numbers are above.
              </p>
            ) : (
              <div className="usage__scroll">
                <table className="usage__table">
                  <thead>
                    <tr>
                      <th scope="col">Day</th>
                      {COLUMNS.map(([label]) => (
                        <th key={label} scope="col">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((row) => (
                      <tr key={row.day}>
                        <th scope="row">{dayFormat.format(parseIsoDate(row.day))}</th>
                        {COLUMNS.map(([label, key]) => (
                          <td key={label}>{number.format(row[key])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
