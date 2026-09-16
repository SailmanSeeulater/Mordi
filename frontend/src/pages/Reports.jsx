import { useCallback, useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import AppShell from '../components/AppShell';
import useDocumentTitle from '../hooks/useDocumentTitle';
import useToday from '../hooks/useToday';
import { addDays, formatWeekRange, startOfWeek, toIsoDate } from './dashboardData';
import {
  normaliseReport,
  reportWeekLabel,
  sortReports,
  weekOnWeekDelta,
} from './reportData';
import './reports.css';

const MOOD_TONE = {
  great: 'up',
  good: 'up',
  neutral: 'flat',
  bad: 'down',
  terrible: 'down',
};

const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');

function Bar({ percent }) {
  return (
    <span className="rep-bar" aria-hidden="true">
      <span className="rep-bar__fill" style={{ width: `${Math.min(percent, 100)}%` }} />
    </span>
  );
}

function Delta({ value }) {
  if (value == null || value === 0) return null;
  const up = value > 0;
  return (
    <span className={`rep-delta rep-delta--${up ? 'up' : 'down'}`}>
      {up ? '+' : '−'}
      {Math.abs(value)} pts
      <span className="app-sr"> {up ? 'better' : 'worse'} than the week before</span>
    </span>
  );
}

function ReportCard({ report, delta }) {
  return (
    <li className="rep-card app-glass">
      <div className="rep-card__head">
        <h3 className="rep-card__week">{reportWeekLabel(report)}</h3>
        <span className="app-panel__spacer" />
        <Delta value={delta} />
      </div>

      <p className="rep-card__figure">
        {report.percent}
        <small>%</small>
      </p>
      <Bar percent={report.percent} />

      <dl className="rep-card__stats">
        <div>
          <dt>{report.legacy ? 'Ticked' : 'Achieved'}</dt>
          <dd>
            {report.achieved} of {report.planned}
          </dd>
        </div>
        <div>
          <dt>Entries</dt>
          <dd>{report.logged}</dd>
        </div>
        {report.goalsTotal != null && (
          <div>
            <dt>On target</dt>
            <dd>
              {report.goalsOnTrack} of {report.goalsTotal}
            </dd>
          </div>
        )}
        <div>
          <dt>Mood</dt>
          <dd>
            {report.mood ? (
              <span className={`mood mood--${MOOD_TONE[report.mood] ?? 'flat'}`}>
                {capitalize(report.mood)}
              </span>
            ) : (
              <span className="rep-card__none">Not recorded</span>
            )}
          </dd>
        </div>
      </dl>

      {report.summary && <p className="rep-card__summary">{report.summary}</p>}

      {report.legacy && (
        <p className="rep-card__note">
          Written before the report changed. This percentage is the share of the entries you
          logged that you ticked off, not the share of what you planned.
        </p>
      )}
    </li>
  );
}

export default function Reports() {
  useDocumentTitle('Weekly report');

  const today = useToday();
  const [rows, setRows] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    client
      .get('/api/reports')
      .then((res) => {
        if (cancelled) return;
        // A 200 carrying something other than a list must not reach render.
        if (!Array.isArray(res.data)) {
          setLoadState('error');
          return;
        }
        setRows(res.data);
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const retry = useCallback(() => {
    setLoadState('loading');
    setReloadKey((k) => k + 1);
  }, []);

  const reports = useMemo(() => sortReports(rows).map(normaliseReport), [rows]);
  const deltas = useMemo(() => weekOnWeekDelta(reports), [reports]);

  const thisWeek = startOfWeek(today);
  const lastWeek = addDays(thisWeek, -7);

  const generate = async (weekStart, key) => {
    setBusy(key);
    setError('');
    try {
      await client.post('/api/reports/generate', null, {
        params: { week: toIsoDate(weekStart) },
      });
      reload();
    } catch {
      setError("Couldn't write that report. Check your connection and try again.");
    }
    setBusy('');
  };

  return (
    <AppShell title="Weekly report">
      {loadState === 'loading' && (
        <p className="app-status" role="status">
          Loading your reports…
        </p>
      )}

      {loadState === 'error' && (
        <div className="app-status" role="alert">
          <span>Couldn&rsquo;t load your reports.</span>
          <button type="button" className="app-btn app-btn--quiet" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {loadState === 'ready' && (
        <>
          <section className="rep-make app-glass" aria-labelledby="rep-make-title">
            <h2 className="rep-make__title" id="rep-make-title">
              Write up a week
            </h2>
            <p className="rep-make__body">
              A report counts the days you logged against the target each goal was given, and
              keeps one write-up per week. Running it again on a week you have already written
              up replaces that write-up with current numbers.
            </p>
            <div className="rep-make__actions">
              <button
                type="button"
                className="app-btn"
                onClick={() => generate(thisWeek, 'this')}
                disabled={busy !== ''}
              >
                {busy === 'this' ? 'Writing…' : `This week · ${formatWeekRange(thisWeek)}`}
              </button>
              <button
                type="button"
                className="app-btn app-btn--ghost"
                onClick={() => generate(lastWeek, 'last')}
                disabled={busy !== ''}
              >
                {busy === 'last' ? 'Writing…' : `Last week · ${formatWeekRange(lastWeek)}`}
              </button>
            </div>
            {error && (
              <p className="app-form__error" role="alert">
                {error}
              </p>
            )}
          </section>

          {reports.length === 0 ? (
            <section className="app-panel">
              <div className="app-panel__head">
                <h2 className="app-panel__title">No reports yet</h2>
              </div>
              <p className="app-empty">
                Write up this week and it shows up here. Each new week adds a card, so you can
                see one week against the next.
              </p>
            </section>
          ) : (
            <section aria-labelledby="rep-list-title">
              <h2 className="app-sr" id="rep-list-title">
                Past weeks
              </h2>
              <ul className="rep-list">
                {reports.map((report) => (
                  <ReportCard key={report.id} report={report} delta={deltas.get(report.id)} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}
