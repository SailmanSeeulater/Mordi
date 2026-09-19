import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import AppShell from '../components/AppShell';
import useDocumentTitle from '../hooks/useDocumentTitle';
import useToday from '../hooks/useToday';
import { addDays, formatWeekRange, startOfWeek, toIsoDate } from './dashboardData';
import { ensureLastWeekReport } from '../lib/autoReview';
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

/**
 * Completion for each written-up week, oldest to newest, so the run of weeks
 * reads left to right. Each bar opens its week.
 */
function Trend({ reports }) {
  const weeks = [...reports].slice(0, 12).reverse();
  if (weeks.length < 2) return null;
  return (
    <section className="app-panel rep-trend" aria-labelledby="rep-trend-title">
      <div className="app-panel__head">
        <h2 className="app-panel__title" id="rep-trend-title">
          Completion by week
        </h2>
        <div className="app-panel__spacer" />
        <span className="app-panel__meta">
          {weeks.length} weeks
        </span>
      </div>
      <ol className="rep-trend__bars">
        {weeks.map((r, i) => (
          <li key={r.id} style={{ '--i': i }}>
            <Link
              to={`/reports/${r.weekStart}`}
              className={`rep-trend__bar${r.legacy ? ' rep-trend__bar--legacy' : ''}`}
              aria-label={`${reportWeekLabel(r)}: ${r.percent}%. Open this week.`}
            >
              <span className="rep-trend__value">{r.percent}%</span>
              <span className="rep-trend__fill" style={{ height: `${Math.max(3, Math.min(r.percent, 100))}%` }} />
            </Link>
            <span className="rep-trend__label" aria-hidden="true">
              {reportWeekLabel(r).split(' \u2013 ')[0]}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ReportCard({ report, delta }) {
  return (
    <li className="rep-card app-glass">
      <div className="rep-card__head">
        <h3 className="rep-card__week">
          {/* The whole card is the link: its ::after covers the card. */}
          <Link to={`/reports/${report.weekStart}`} className="rep-card__link">
            {reportWeekLabel(report)}
          </Link>
        </h3>
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
      <span className="rep-card__open" aria-hidden="true">
        Open the week
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </li>
  );
}

export default function Reports() {
  useDocumentTitle('Weekly report');

  const today = useToday();
  const [rows, setRows] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [reloadKey, setReloadKey] = useState(0);

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

  // Last week writes itself up the first time it is looked at after it
  // ends, if anything was logged in it. Then the list reloads to include it.
  const lastWeekIso = toIsoDate(lastWeek);
  const hasLastWeek = rows.some((r) => r.weekStart === lastWeekIso);
  useEffect(() => {
    if (loadState !== 'ready' || hasLastWeek) return undefined;
    let live = true;
    client
      .get('/api/behaviors/range', { params: { start: lastWeekIso, end: toIsoDate(addDays(lastWeek, 6)) } })
      .then((res) => ensureLastWeekReport(today, Array.isArray(res.data) && res.data.length > 0))
      .then((made) => {
        if (live && made) reload();
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // lastWeek is derived from today, which lastWeekIso already stands for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadState, hasLastWeek, lastWeekIso]);

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
              Every week writes itself up
            </h2>
            <p className="rep-make__body">
              Once a week ends, Mordi writes it up the next time you open it: what you logged
              against the target each goal was given. Open any week to see it taken apart.
            </p>
            <div className="rep-make__actions">
              <Link to={`/reports/${toIsoDate(thisWeek)}`} className="app-btn">
                This week so far &middot; {formatWeekRange(thisWeek)}
              </Link>
            </div>
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
            <>
            <Trend reports={reports} />
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
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
