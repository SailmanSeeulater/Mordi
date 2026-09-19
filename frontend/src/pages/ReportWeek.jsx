import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import client from '../api/client';
import AppShell from '../components/AppShell';
import useDocumentTitle from '../hooks/useDocumentTitle';
import useToday from '../hooks/useToday';
import { addDays, parseIsoDate, startOfWeek, toIsoDate } from './dashboardData';
import { buildWeekReport, headline, hoursMinutes } from '../lib/weekReport';
import './report-week.css';

const dayShort = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const dayLong = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
const rangeFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function weekRange(monday) {
  const sunday = addDays(monday, 6);
  return `${rangeFormat.format(monday)} – ${rangeFormat.format(sunday)}, ${sunday.getFullYear()}`;
}

/* ── The week, goal by goal ─────────────────────────────────── */

function cellLabel(cell) {
  if (cell.status === 'future') return 'still to come';
  if (!cell.count) return cell.status === 'missed' ? 'missed' : 'nothing logged';
  return `${cell.count} ${cell.count === 1 ? 'entry' : 'entries'}${cell.completed ? ', done' : ', not done'}`;
}

function GoalMatrix({ report }) {
  const today = toIsoDate(new Date());
  return (
    <section className="wk-block wk-block--wide" aria-labelledby="wk-matrix-title">
      <header className="wk-block__head">
        <h3 id="wk-matrix-title">The week, goal by goal</h3>
        <p>
          {report.goalsOnTarget} of {report.goalsTotal} {report.goalsTotal === 1 ? 'goal' : 'goals'} reached target
          {report.looseEntries > 0 && `, plus ${report.looseEntries} ${report.looseEntries === 1 ? 'entry' : 'entries'} not tied to a goal`}
        </p>
      </header>
      {report.matrix.length === 0 ? (
        <p className="wk-empty">No goals had a target this week.</p>
      ) : (
        <div className="wk-matrix__scroll">
          <table className="wk-matrix">
            <thead>
              <tr>
                <th scope="col" className="wk-matrix__goal">
                  <span className="app-sr">Goal</span>
                </th>
                {report.perDay.map((d) => (
                  <th key={d.iso} scope="col" className={d.iso === today ? 'is-today' : undefined}>
                    <span>{dayShort.format(d.date)}</span>
                    <strong>{d.date.getDate()}</strong>
                  </th>
                ))}
                <th scope="col" className="wk-matrix__score">
                  Target
                </th>
              </tr>
            </thead>
            <tbody>
              {report.matrix.map((row, r) => {
                const pct = Math.min(100, Math.round((row.done / row.target) * 100));
                return (
                  <tr key={row.goal.id} style={{ '--row': r }}>
                    <th scope="row" className="wk-matrix__goal">
                      {row.goal.title}
                    </th>
                    {row.cells.map((cell) => {
                      const level = Math.min(cell.count, 3);
                      const kind = cell.status === 'future'
                        ? 'future'
                        : cell.count
                          ? cell.completed
                            ? 'done'
                            : 'open'
                          : cell.status === 'missed'
                            ? 'missed'
                            : 'none';
                      return (
                        <td key={cell.iso}>
                          <span
                            className={`wk-cell wk-cell--${kind}`}
                            data-level={level}
                            title={`${row.goal.title}, ${dayLong.format(parseIsoDate(cell.iso))}: ${cellLabel(cell)}`}
                          >
                            <span className="app-sr">{cellLabel(cell)}</span>
                            {cell.count > 1 && <span aria-hidden="true">{cell.count}</span>}
                          </span>
                        </td>
                      );
                    })}
                    <td className="wk-matrix__score">
                      <span className={`wk-score${row.done >= row.target ? ' wk-score--met' : ''}`}>
                        {row.done}/{row.target}
                      </span>
                      <span className="wk-meter" aria-hidden="true">
                        <span style={{ width: `${pct}%` }} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="wk-matrix__goal">
                  Entries
                </th>
                {report.perDay.map((d) => (
                  <td key={d.iso} className="wk-matrix__total">
                    {d.total || ''}
                  </td>
                ))}
                <td className="wk-matrix__score wk-matrix__total">{report.entries}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <ul className="wk-legend" aria-hidden="true">
        <li><span className="wk-cell wk-cell--done" data-level="1" />Done</li>
        <li><span className="wk-cell wk-cell--done" data-level="3" />Done, several times</li>
        <li><span className="wk-cell wk-cell--open" data-level="1" />Logged, not done</li>
        <li><span className="wk-cell wk-cell--missed" />Missed a daily goal</li>
      </ul>
    </section>
  );
}

/* ── Entries each day ───────────────────────────────────────── */

function niceMax(n) {
  if (n <= 4) return 4;
  if (n <= 6) return 6;
  if (n <= 8) return 8;
  return Math.ceil(n / 5) * 5;
}

function DayBars({ report }) {
  const max = niceMax(Math.max(1, ...report.perDay.map((d) => Math.max(d.total, d.prevTotal))));
  const ticks = [max, max / 2, 0];
  const up = report.entries - report.prevEntries;
  return (
    <section className="wk-block" aria-labelledby="wk-days-title">
      <header className="wk-block__head">
        <h3 id="wk-days-title">Entries each day</h3>
        <p>
          {report.entries} this week
          {report.prevEntries > 0 && (
            <>
              , {up === 0 ? 'the same as' : `${Math.abs(up)} ${up > 0 ? 'more than' : 'fewer than'}`} last week
            </>
          )}
        </p>
      </header>
      <div className="wk-bars" style={{ '--max': max }} aria-hidden="true">
        <div className="wk-bars__axis">
          {ticks.map((t) => (
            <span key={t} style={{ bottom: `${(t / max) * 100}%` }}>
              {t}
            </span>
          ))}
        </div>
        <div className="wk-bars__plot">
          {ticks.map((t) => (
            <span key={t} className="wk-bars__grid" style={{ bottom: `${(t / max) * 100}%` }} />
          ))}
          {report.perDay.map((d, i) => (
            <div key={d.iso} className={`wk-bars__col${d.future ? ' is-future' : ''}`} style={{ '--i': i }}>
              <div className="wk-bars__stack">
                {d.total > 0 && <span className="wk-bars__value" style={{ bottom: `${(d.total / max) * 100}%` }}>{d.total}</span>}
                <span className="wk-bar wk-bar--done" style={{ height: `${(d.completed / max) * 100}%` }} />
                <span className="wk-bar wk-bar--open" style={{ height: `${(d.notDone / max) * 100}%`, bottom: `${(d.completed / max) * 100}%` }} />
                {report.prevEntries > 0 && (
                  <span className="wk-bars__prev" style={{ bottom: `${(d.prevTotal / max) * 100}%` }} />
                )}
              </div>
              <span className="wk-bars__label">{dayShort.format(d.date)}</span>
            </div>
          ))}
        </div>
      </div>
      <ul className="wk-legend" aria-hidden="true">
        <li><span className="wk-swatch wk-swatch--done" />Done</li>
        <li><span className="wk-swatch wk-swatch--open" />Not done</li>
        {report.prevEntries > 0 && <li><span className="wk-swatch wk-swatch--prev" />Last week</li>}
      </ul>
      <table className="app-sr">
        <caption>Entries each day</caption>
        <thead>
          <tr><th scope="col">Day</th><th scope="col">Done</th><th scope="col">Not done</th><th scope="col">Last week</th></tr>
        </thead>
        <tbody>
          {report.perDay.map((d) => (
            <tr key={d.iso}>
              <th scope="row">{dayLong.format(d.date)}</th>
              <td>{d.completed}</td>
              <td>{d.notDone}</td>
              <td>{d.prevTotal}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ── How it felt ────────────────────────────────────────────── */

function moodLevel(score) {
  if (score === null) return null;
  if (score >= 1.5) return 'great';
  if (score >= 0.5) return 'good';
  if (score > -0.5) return 'neutral';
  if (score > -1.5) return 'bad';
  return 'terrible';
}

function MoodBlock({ report }) {
  const total = report.moodTotal;
  return (
    <section className="wk-block" aria-labelledby="wk-mood-title">
      <header className="wk-block__head">
        <h3 id="wk-mood-title">How it felt</h3>
        <p>{total ? `${total} ${total === 1 ? 'entry' : 'entries'} with a mood` : 'No moods recorded'}</p>
      </header>
      {total > 0 ? (
        <>
          <div className="wk-mood" aria-hidden="true">
            {report.moods.filter((m) => m.count).map((m, i) => (
              <span
                key={m.mood}
                className={`wk-mood__seg wk-mood--${m.mood}`}
                style={{ flexGrow: m.count, '--i': i }}
                title={`${cap(m.mood)}: ${m.count}`}
              />
            ))}
          </div>
          <ul className="wk-mood__legend">
            {report.moods.map((m) => (
              <li key={m.mood} className={m.count ? undefined : 'is-zero'}>
                <span className={`wk-mood__key wk-mood--${m.mood}`} aria-hidden="true" />
                <span>{cap(m.mood)}</span>
                <strong>{m.count}</strong>
                <span className="wk-mood__pct">{Math.round((m.count / total) * 100)}%</span>
              </li>
            ))}
          </ul>
          <div className="wk-moodline">
            {report.perDay.map((d) => {
              const level = moodLevel(d.mood);
              return (
                <span key={d.iso} className="wk-moodline__day">
                  <span
                    className={`wk-moodline__dot${level ? ` wk-mood--${level}` : ' is-empty'}`}
                    title={`${dayLong.format(d.date)}: ${level ? cap(level) : 'no mood'}`}
                  >
                    <span className="app-sr">
                      {dayLong.format(d.date)}: {level ? cap(level) : 'no mood'}
                    </span>
                  </span>
                  <span aria-hidden="true">{dayShort.format(d.date)[0]}</span>
                </span>
              );
            })}
          </div>
        </>
      ) : (
        <p className="wk-empty">Add a mood when you log an entry and it shows up here.</p>
      )}
    </section>
  );
}

/* ── Where the time went ────────────────────────────────────── */

function TimeBlock({ report }) {
  const top = report.time.slice(0, 6);
  const max = top[0]?.seconds ?? 1;
  const planned = report.plan.plannedSeconds;
  const tracked = report.trackedSeconds;
  const scale = Math.max(planned, tracked, 1);
  return (
    <section className="wk-block" aria-labelledby="wk-time-title">
      <header className="wk-block__head">
        <h3 id="wk-time-title">Where the time went</h3>
        <p>{tracked ? `${hoursMinutes(tracked)} tracked` : 'No timed sessions'}</p>
      </header>
      {top.length > 0 ? (
        <ol className="wk-time">
          {top.map((t, i) => (
            <li key={t.name} style={{ '--i': i }}>
              <span className="wk-time__name">{t.name}</span>
              <span className="wk-time__bar" aria-hidden="true">
                <span style={{ width: `${(t.seconds / max) * 100}%` }} />
              </span>
              <span className="wk-time__value">{hoursMinutes(t.seconds)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="wk-empty">Sessions saved from the timer on the dashboard are counted here.</p>
      )}
      {planned > 0 && (
        <div className="wk-plan">
          <p className="wk-plan__title">Planned against tracked</p>
          <div className="wk-plan__row">
            <span>Planned</span>
            <span className="wk-plan__bar wk-plan__bar--planned" aria-hidden="true">
              <span style={{ width: `${(planned / scale) * 100}%` }} />
            </span>
            <strong>{hoursMinutes(planned)}</strong>
          </div>
          <div className="wk-plan__row">
            <span>Tracked</span>
            <span className="wk-plan__bar" aria-hidden="true">
              <span style={{ width: `${(tracked / scale) * 100}%` }} />
            </span>
            <strong>{hoursMinutes(tracked)}</strong>
          </div>
          <p className="wk-plan__note">
            {report.plan.timedEvents} timed {report.plan.timedEvents === 1 ? 'event' : 'events'} on the calendar this week.
          </p>
        </div>
      )}
    </section>
  );
}

/* ── Places ─────────────────────────────────────────────────── */

function PlacesBlock({ report }) {
  if (!report.places.length) return null;
  return (
    <section className="wk-block" aria-labelledby="wk-places-title">
      <header className="wk-block__head">
        <h3 id="wk-places-title">Where you were</h3>
        <p>
          {report.places.length} {report.places.length === 1 ? 'place' : 'places'}
        </p>
      </header>
      <ul className="wk-places">
        {report.places.slice(0, 8).map((p) => (
          <li key={p.name}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="M12 21s-6-5.3-6-10a6 6 0 0112 0c0 4.7-6 10-6 10z" />
              <circle cx="12" cy="11" r="2.2" />
            </svg>
            <span className="app-trunc">{p.name}</span>
            <strong>{p.count}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * One week, taken apart: a sentence saying how it went against the targets
 * set, then the week as a goal × day grid, entries per day against the week
 * before, the mood mix and its day-by-day line, where tracked time went and
 * how it compares with what was planned, and where it happened.
 *
 * Works for any week, written up or not: the written summary is shown when a
 * report exists, and one can be written from here.
 */
export default function ReportWeek() {
  const { week } = useParams();
  const navigate = useNavigate();
  const today = useToday();
  const monday = useMemo(() => startOfWeek(parseIsoDate(week ?? toIsoDate(new Date()))), [week]);
  const mondayIso = toIsoDate(monday);
  useDocumentTitle(`Week of ${rangeFormat.format(monday)}`);

  const [data, setData] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [writing, setWriting] = useState(false);
  const [writeError, setWriteError] = useState('');

  const load = useCallback(async () => {
    const sunday = toIsoDate(addDays(monday, 6));
    const prevMonday = toIsoDate(addDays(monday, -7));
    try {
      const [goals, behaviors, events, reports] = await Promise.allSettled([
        client.get('/api/goals'),
        client.get('/api/behaviors/range', { params: { start: prevMonday, end: sunday } }),
        client.get('/api/events', { params: { start: mondayIso, end: sunday } }),
        client.get('/api/reports'),
      ]);
      if (goals.status !== 'fulfilled' || behaviors.status !== 'fulfilled') throw new Error('load failed');
      setData({
        goals: Array.isArray(goals.value.data) ? goals.value.data : [],
        behaviors: Array.isArray(behaviors.value.data) ? behaviors.value.data : [],
        events: events.status === 'fulfilled' && Array.isArray(events.value.data) ? events.value.data : [],
        written:
          reports.status === 'fulfilled' && Array.isArray(reports.value.data)
            ? reports.value.data.filter((r) => r.weekStart === mondayIso).sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0] ?? null
            : null,
      });
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, [monday, mondayIso]);

  useEffect(() => {
    // Async: state is only set once the requests answer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const report = useMemo(
    () => (data ? buildWeekReport({ ...data, weekStart: monday, today }) : null),
    [data, monday, today],
  );

  const go = (delta) => navigate(`/reports/${toIsoDate(addDays(monday, delta * 7))}`);
  const isCurrentOrFuture = monday >= startOfWeek(today);

  const write = async () => {
    setWriting(true);
    setWriteError('');
    try {
      await client.post('/api/reports/generate', null, { params: { week: mondayIso } });
      await load();
    } catch {
      setWriteError("Couldn't write up this week. Check your connection and try again.");
    }
    setWriting(false);
  };

  return (
    <AppShell title="Weekly report">
      <nav className="wk-nav" aria-label="Weeks">
        <Link to="/reports" className="wk-nav__back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          All reports
        </Link>
        <div className="app-panel__spacer" />
        <button type="button" className="app-btn app-btn--quiet app-btn--sm" onClick={() => go(-1)}>
          Previous week
        </button>
        <button type="button" className="app-btn app-btn--quiet app-btn--sm" onClick={() => go(1)} disabled={isCurrentOrFuture}>
          Next week
        </button>
      </nav>

      {loadState === 'loading' && (
        <p className="app-status" role="status">
          Putting the week together&hellip;
        </p>
      )}
      {loadState === 'error' && (
        <div className="app-status" role="alert">
          <span>Couldn&rsquo;t load this week.</span>
          <button type="button" className="app-btn app-btn--quiet" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {loadState === 'ready' && report && (
        <article className="wk">
          <header className="wk-head">
            <p className="wk-head__range">{weekRange(monday)}</p>
            <h2 className="wk-head__line">{headline(report)}</h2>
            <dl className="wk-facts">
              <div>
                <dt>Entries</dt>
                <dd>{report.entries}</dd>
              </div>
              <div>
                <dt>Days active</dt>
                <dd>{report.activeDays} of 7</dd>
              </div>
              <div>
                <dt>Longest run</dt>
                <dd>{report.longestRun} {report.longestRun === 1 ? 'day' : 'days'}</dd>
              </div>
              <div>
                <dt>Tracked</dt>
                <dd>{hoursMinutes(report.trackedSeconds)}</dd>
              </div>
              {report.busiest && (
                <div>
                  <dt>Busiest</dt>
                  <dd>{dayShort.format(report.busiest.date)}, {report.busiest.total}</dd>
                </div>
              )}
            </dl>
          </header>

          <GoalMatrix report={report} />
          <div className="wk-grid">
            <DayBars report={report} />
            <MoodBlock report={report} />
            <TimeBlock report={report} />
            <PlacesBlock report={report} />
          </div>

          <section className="wk-block wk-block--wide wk-written" aria-labelledby="wk-written-title">
            <header className="wk-block__head">
              <h3 id="wk-written-title">Written up</h3>
              <p>{data.written ? 'Saved with this week’s numbers when it was written' : 'Not written up yet'}</p>
            </header>
            {data.written?.summary && <p className="wk-written__text">{data.written.summary}</p>}
            <button type="button" className="app-btn app-btn--quiet app-btn--sm" onClick={write} disabled={writing}>
              {writing ? 'Writing…' : data.written ? 'Write it up again' : 'Write up this week'}
            </button>
            {writeError && (
              <p className="app-form__error" role="alert">
                {writeError}
              </p>
            )}
          </section>
        </article>
      )}
    </AppShell>
  );
}

