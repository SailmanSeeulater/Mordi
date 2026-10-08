import { useRef } from 'react';
import useCountUp from '../hooks/useCountUp';
import { useInView, usePlayhead } from '../hooks/useLandingMotion';
import { weekPace, paceLabel } from './dashboardData';
import { composeReminder } from '../lib/reminder';
import { headline } from '../lib/weekReport';
import { MODULES } from '../lib/modules';
import { THEMES } from '../context/theme-context-value';
import { DEMO_GOALS, DEMO_THREAD, DEMO_TEXT } from './landingCopy';

/*
 * The landing page's product demos. Each rebuilds a surface of the app in
 * HTML and CSS and plays once when it scrolls into view. Wherever the app has
 * the logic (the pace line, the report headline, the module list, the color
 * combinations) the demo calls it, so the page cannot drift from the product.
 * The figures are illustrative and every demo says so.
 *
 * Under reduced motion each demo shows its last frame and nothing moves.
 */

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TODAY = 3; // Thursday
const PLANNED = DEMO_GOALS.reduce((s, g) => s + g.target, 0);

function Illustrative({ children = DEMO_TEXT.illustrative }) {
  return <p className="lp-illus">{children}</p>;
}

function Replay({ onClick, hidden }) {
  if (hidden) return null;
  return (
    <button type="button" className="lp-replay" onClick={onClick}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
      </svg>
      {DEMO_TEXT.replay}
    </button>
  );
}

/* ── Hero: the week card ─────────────────────────────────── */

const HERO_HOLDS = [450, 1500, 900, 1400, 900];
const HERO_FRAMES = [
  { count: 0, thu: 0, lately: 0 },
  { count: 6, thu: 0, lately: 0 },
  { count: 6, thu: 0, lately: 0, pressing: true },
  { count: 7, thu: 1, lately: 1 },
  { count: 7, thu: 1, lately: 1, pressing: true },
  { count: 8, thu: 2, lately: 2 },
];
const HERO_BASE = [3, 2, 1, 0, 0, 0, 0];

export function HeroWeekDemo() {
  const ref = useRef(null);
  const inView = useInView(ref, 0.2);
  const [phase, replay, done] = usePlayhead(inView, HERO_HOLDS);
  const frame = HERO_FRAMES[phase];
  const [shown, counting] = useCountUp(frame.count, 520);
  const pace = weekPace(PLANNED, frame.count, TODAY);
  const counts = HERO_BASE.map((n, i) => (i === TODAY ? frame.thu : n));
  const busiest = Math.max(...counts);
  const lately = DEMO_TEXT.heroLately.slice(0, frame.lately).reverse();

  return (
    <div className="lp-hero-demo" ref={ref}>
      <section className="lp-pass" aria-label={DEMO_TEXT.weekCardLabel}>
        <div className="lp-pass__body">
          <div>
            <p className="lp-pass__figure">
              <span className={'lp-pass__count' + (counting ? ' lp-pop' : '')}>{shown}</span>
              <span className="lp-pass__of">of {PLANNED}</span>
            </p>
            <p className="lp-pass__pace" aria-live="polite">
              {phase === 0 ? ' ' : paceLabel(pace)}
              <span className="lp-pass__range"> · this week</span>
            </p>
          </div>
          <dl className="lp-pass__fields">
            <div>
              <dt>Goals on target</dt>
              <dd>1 of {DEMO_GOALS.length}</dd>
            </div>
            <div>
              <dt>Best day</dt>
              <dd>Mon</dd>
            </div>
          </dl>
        </div>

        <ol className="lp-days" aria-label={DEMO_TEXT.daysLabel}>
          {DAYS.map((d, i) => {
            const state = i === TODAY ? 'today' : i > TODAY ? 'ahead' : '';
            return (
              <li
                key={DAY_NAMES[i]}
                className={'lp-day' + (state ? ` lp-day--${state}` : '')}
                aria-label={`${DAY_NAMES[i]}: ${counts[i]} logged`}
              >
                <span
                  className="lp-day__bar"
                  style={{ '--fill': phase === 0 ? 0 : counts[i] / busiest, '--i': i }}
                  aria-hidden="true"
                />
                <span className="lp-day__letter" aria-hidden="true">{d}</span>
                <span className="lp-day__count" aria-hidden="true">{i > TODAY ? '' : counts[i]}</span>
              </li>
            );
          })}
        </ol>

        <div className="lp-pass__action">
          <span className={'lp-pass__cta' + (frame.pressing ? ' is-pressed' : '')} aria-hidden="true">
            Log today
          </span>
        </div>
      </section>

      <div className="lp-lately" aria-label={DEMO_TEXT.latelyLabel}>
        <p className="lp-lately__date">Today</p>
        <ul className="lp-lately__list">
          {lately.length === 0 && <li className="lp-lately__empty">{DEMO_TEXT.latelyEmpty}</li>}
          {lately.map((e) => (
            <li className="lp-lately__row lp-rise" key={e.note}>
              <span className="lp-lately__note">{e.note}</span>
              <span className="lp-chip">{e.goal}</span>
              <span className="lp-chip lp-chip--quiet">{e.mood}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="lp-demo-foot">
        <Illustrative />
        <Replay onClick={replay} hidden={!done} />
      </div>
    </div>
  );
}

/* ── How it works, step 1: a goal with a weekly target ───── */

const GOAL_HOLDS = [500, 1100, 800, 1200];

export function GoalDemo() {
  const ref = useRef(null);
  const [phase] = usePlayhead(useInView(ref), GOAL_HOLDS);
  const target = phase >= 3 ? 4 : 1;

  return (
    <div className="lp-sheet" ref={ref}>
      <p className="lp-sheet__title">New goal</p>
      <div className="lp-field">
        <span className="lp-field__label">Title</span>
        <span className="lp-input">
          {phase >= 1 ? (
            <span className="lp-type">Morning run</span>
          ) : (
            <span className="lp-input__ph">e.g. Morning run</span>
          )}
        </span>
      </div>
      <div className="lp-field">
        <span className="lp-field__label">Category</span>
        <span className="lp-chips">
          {['Fitness', 'Sleep', 'Productivity', 'Health'].map((c) => (
            <span key={c} className={'lp-chip' + (phase >= 2 && c === 'Fitness' ? ' lp-chip--on' : '')}>
              {c}
            </span>
          ))}
        </span>
      </div>
      <div className="lp-field">
        <span className="lp-field__label">
          Times a week <span className="lp-field__value">{target}× weekly</span>
        </span>
        <span className="lp-segments" aria-hidden="true">
          <span className="lp-segments__thumb" style={{ '--n': 7, '--i': target - 1 }} />
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <span key={n} className={'lp-segment' + (n === target ? ' is-on' : '')}>{n}</span>
          ))}
        </span>
      </div>
      {phase >= 4 ? (
        <div className="lp-goalpass lp-rise">
          <span className="lp-goalpass__title">Morning run</span>
          <span className="lp-goalpass__meta">4× weekly · 0 of 4 this week</span>
        </div>
      ) : (
        <span className={'lp-btn-fake' + (phase === 3 ? ' is-pressed' : '')}>Save goal</span>
      )}
    </div>
  );
}

/* ── How it works, step 2: one entry ─────────────────────── */

const LOG_HOLDS = [600, 900, 1200, 600];
const MOODS = ['Great', 'Good', 'Okay', 'Low', 'Rough'];

function Ring({ value, target, size = 64 }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg className="lp-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle className="lp-ring__track" cx={size / 2} cy={size / 2} r={r} />
      <circle
        className="lp-ring__fill"
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value / target)}
      />
    </svg>
  );
}

export function LogDemo() {
  const ref = useRef(null);
  const [phase] = usePlayhead(useInView(ref), LOG_HOLDS);
  const logged = phase >= 4;

  return (
    <div className="lp-log" ref={ref}>
      <div className="lp-sheet">
        <p className="lp-sheet__title">Log today</p>
        <div className="lp-field">
          <span className="lp-field__label">Goal</span>
          <span className="lp-input">Morning run</span>
        </div>
        <div className="lp-field">
          <span className="lp-field__label">How did it feel?</span>
          <span className="lp-chips">
            {MOODS.map((m) => (
              <span key={m} className={'lp-chip' + (phase >= 1 && m === 'Good' ? ' lp-chip--on' : '')}>
                {m}
              </span>
            ))}
          </span>
        </div>
        <div className="lp-field">
          <span className="lp-field__label">Note</span>
          <span className="lp-input">
            {phase >= 2 ? (
              <span className="lp-type">Easy 5k by the river</span>
            ) : (
              <span className="lp-input__ph">Optional</span>
            )}
          </span>
        </div>
        <span className={'lp-btn-fake' + (phase === 3 ? ' is-pressed' : '')}>Save</span>
      </div>
      <div className={'lp-goalring' + (logged ? ' lp-pop' : '')}>
        <Ring value={logged ? 3 : 2} target={4} />
        <div>
          <p className="lp-goalring__title">Morning run</p>
          <p className="lp-goalring__meta">{logged ? 3 : 2} of 4 this week</p>
        </div>
      </div>
    </div>
  );
}

/* ── How it works, step 3: rest days versus missed days ──── */

const WEEK_HOLDS = [250, 1500];
const WEEK_ROWS = [
  { title: 'Morning run', meta: '4× weekly', days: [1, 0, 1, 1], rule: 'rest' },
  { title: 'Read before bed', meta: 'Daily', days: [1, 1, 0, 1], rule: 'missed' },
];

export function WeekRuleDemo() {
  const ref = useRef(null);
  const [phase] = usePlayhead(useInView(ref), WEEK_HOLDS);

  return (
    <div className={'lp-rule' + (phase >= 1 ? ' is-on' : '')} ref={ref}>
      {WEEK_ROWS.map((row, r) => (
        <div className="lp-rule__row" key={row.title}>
          <div className="lp-rule__head">
            <span className="lp-rule__title">{row.title}</span>
            <span className="lp-rule__meta">{row.meta}</span>
          </div>
          <ol className="lp-rule__days">
            {DAYS.map((d, i) => {
              const v = row.days[i];
              let cls = 'lp-cell';
              let label = 'still to come';
              if (i <= TODAY) {
                if (v) {
                  cls += ' lp-cell--done';
                  label = 'done';
                } else if (row.rule === 'missed') {
                  cls += ' lp-cell--missed';
                  label = 'missed';
                } else {
                  cls += ' lp-cell--rest';
                  label = 'rest day';
                }
              } else cls += ' lp-cell--ahead';
              return (
                <li key={DAY_NAMES[i]} className={cls} style={{ '--i': r * 7 + i }}
                  aria-label={`${DAY_NAMES[i]}: ${label}`}>
                  <span aria-hidden="true">{d}</span>
                </li>
              );
            })}
          </ol>
          <p className="lp-rule__note">
            {row.rule === 'missed' ? DEMO_TEXT.ruleMissed : DEMO_TEXT.ruleRest}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ── The weekly report ───────────────────────────────────── */

const REPORT_HOLDS = [200];
const REPORT_GRID = [
  { title: 'Morning run', days: [1, 0, 1, 1, 0, 1, 0] },
  { title: 'Read before bed', days: [1, 1, 1, 1, 1, 0, 1] },
  { title: 'Stretch', days: [0, 1, 0, 0, 0, 0, 0] },
];
const THIS_WEEK = [2, 2, 2, 2, 1, 1, 1];
const LAST_WEEK = [1, 2, 1, 2, 2, 0, 1];
const MOOD_MIX = [
  { mood: 'Great', n: 3 },
  { mood: 'Good', n: 5 },
  { mood: 'Okay', n: 2 },
  { mood: 'Low', n: 1 },
];
// The app's own headline sentence, fed the illustrative week: 11 of 13
// planned days (85%) against 77% the week before.
const REPORT_HEADLINE = headline({ percent: 85, prevPercent: 77, achieved: 11, planned: 13 });

export function ReportDemo() {
  const ref = useRef(null);
  const [phase] = usePlayhead(useInView(ref, 0.25), REPORT_HOLDS);
  const entries = THIS_WEEK.reduce((s, n) => s + n, 0);

  return (
    <div className={'lp-report' + (phase >= 1 ? ' is-on' : '')} ref={ref}>
      <p className="lp-report__headline">{REPORT_HEADLINE}</p>

      <div className="lp-report__body">
        <figure className="lp-report__block lp-report__block--wide">
          <figcaption>{DEMO_TEXT.reportGrid}</figcaption>
          <table className="lp-heat">
            <thead>
              <tr>
                <th scope="col"><span className="app-sr">Goal</span></th>
                {DAYS.map((d, i) => <th scope="col" key={DAY_NAMES[i]} aria-label={DAY_NAMES[i]}>{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {REPORT_GRID.map((row, r) => (
                <tr key={row.title}>
                  <th scope="row">{row.title}</th>
                  {row.days.map((v, i) => (
                    <td key={DAY_NAMES[i]}>
                      <span className={'lp-heat__cell' + (v ? ' is-done' : '')} style={{ '--i': r * 7 + i }}>
                        <span className="app-sr">{v ? 'done' : 'not logged'}</span>
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </figure>

        <figure className="lp-report__block">
          <figcaption>{DEMO_TEXT.reportBars}</figcaption>
          <div className="lp-bars" aria-hidden="true">
            {DAYS.map((d, i) => (
              <div className="lp-bars__day" key={DAY_NAMES[i]}>
                <div className="lp-bars__pair">
                  <span className="lp-bars__bar lp-bars__bar--prev" style={{ '--h': LAST_WEEK[i] / 2, '--i': i }} />
                  <span className="lp-bars__bar" style={{ '--h': THIS_WEEK[i] / 2, '--i': i }} />
                </div>
                <span className="lp-bars__label">{d}</span>
              </div>
            ))}
          </div>
          <p className="lp-legend">
            <span className="lp-legend__key" /> This week
            <span className="lp-legend__key lp-legend__key--prev" /> Last week
          </p>
        </figure>

        <figure className="lp-report__block">
          <figcaption>{DEMO_TEXT.reportMood}</figcaption>
          <div className="lp-moodbar" aria-hidden="true">
            {MOOD_MIX.map((m, i) => (
              <span key={m.mood} className="lp-moodbar__seg" style={{ '--w': m.n / entries, '--i': i, '--k': i }} />
            ))}
          </div>
          <ul className="lp-moodlist">
            {MOOD_MIX.map((m, i) => (
              <li key={m.mood}>
                <span className="lp-moodlist__key" style={{ '--k': i }} aria-hidden="true" />
                {m.mood} <b>{m.n}</b>
              </li>
            ))}
          </ul>
        </figure>

        <dl className="lp-report__block lp-report__facts">
          <div>
            <dt>Entries</dt>
            <dd>{entries}</dd>
          </div>
          <div>
            <dt>To-dos done</dt>
            <dd>5</dd>
          </div>
          <div>
            <dt>Goals on target</dt>
            <dd>1 of 3</dd>
          </div>
        </dl>
      </div>
      <Illustrative />
    </div>
  );
}

/* ── Reminders: the week card says what is left, then nothing ── */

const REMIND_HOLDS = [900, 2600, 1800];
// Thursday of the example week, then a Sunday with every target met.
const REMIND_THU = composeReminder(
  DEMO_GOALS.map((g, i) => ({ goal: g, target: g.target, done: [1, 3, 2][i] })),
  TODAY,
);
const REMIND_SUN = composeReminder(
  DEMO_GOALS.map((g) => ({ goal: g, target: g.target, done: g.target })),
  6,
);

export function ReminderDemo() {
  const ref = useRef(null);
  const inView = useInView(ref);
  const [phase, replay, done] = usePlayhead(inView, REMIND_HOLDS);
  const sunday = phase >= 3;
  const reminder = sunday ? REMIND_SUN : phase >= 1 ? REMIND_THU : null;
  const count = sunday ? PLANNED : 6;
  const pace = weekPace(PLANNED, count, sunday ? 6 : TODAY);

  return (
    <div className="lp-remind" ref={ref}>
      <p className="lp-remind__when" aria-live="polite">
        {sunday ? DEMO_TEXT.remindSun : DEMO_TEXT.remindThu}
      </p>
      <section className="lp-pass lp-pass--remind" aria-label={DEMO_TEXT.weekCardLabel}>
        <div className="lp-pass__body">
          <div>
            <p className="lp-pass__figure">
              <span className="lp-pass__count">{count}</span>
              <span className="lp-pass__of">of {PLANNED}</span>
            </p>
            <p className="lp-pass__pace">
              {paceLabel(pace)}
              <span className="lp-pass__range"> · this week</span>
            </p>
            {reminder ? (
              <p className="lp-left" key={reminder.title}>
                <strong>{reminder.title}</strong>
                {reminder.items.map((l, i) => (
                  <span className="lp-left__item" key={l.title} style={{ '--i': i }}>
                    {l.title}: {l.left} of {l.target} left
                  </span>
                ))}
              </p>
            ) : (
              sunday && <p className="lp-left lp-left--quiet">{DEMO_TEXT.remindQuiet}</p>
            )}
          </div>
        </div>
      </section>
      <div className="lp-demo-foot">
        <Illustrative />
        <Replay onClick={replay} hidden={!done} />
      </div>
    </div>
  );
}

/* ── To-dos that count ───────────────────────────────────── */

const TODO_HOLDS = [700, 800, 1000, 800];
const TODO_ITEMS = ['Book dentist', 'Return library books', 'Buy running socks'];

export function TodoDemo() {
  const ref = useRef(null);
  const [phase] = usePlayhead(useInView(ref), TODO_HOLDS);
  const ticked = (item) => (item === TODO_ITEMS[0] && phase >= 1) || (item === TODO_ITEMS[2] && phase >= 3);
  const finished = [phase >= 4 && TODO_ITEMS[2], phase >= 2 && TODO_ITEMS[0]].filter(Boolean);

  return (
    <div className="lp-todo" ref={ref}>
      <div className="lp-todo__list">
        <p className="lp-sheet__title">To do</p>
        <ul>
          {TODO_ITEMS.map((item) => (
            <li key={item} className={'lp-todo__item' + (ticked(item) ? ' is-done' : '')}>
              <span className="lp-todo__box" aria-hidden="true" />
              {item}
              {ticked(item) && <span className="app-sr"> (done)</span>}
            </li>
          ))}
        </ul>
      </div>
      <div className="lp-lately lp-lately--flat">
        <p className="lp-sheet__title">Lately</p>
        <p className="lp-lately__date">Today</p>
        <ul className="lp-lately__list">
          {finished.map((item) => (
            <li className="lp-lately__row lp-rise" key={item}>
              <span className="lp-lately__note">{item}</span>
              <span className="lp-chip">To-do done</span>
            </li>
          ))}
          <li className="lp-lately__row">
            <span className="lp-lately__note">Easy 5k by the river</span>
            <span className="lp-chip">Morning run</span>
            <span className="lp-chip lp-chip--quiet">Good</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

/* ── Together: a shared goal ─────────────────────────────── */

const TOGETHER_HOLDS = [250, 1500, 1300];
const MEMBERS = [
  { who: 'You', days: [1, 0, 1, 1] },
  { who: 'AK', days: [1, 1, 0, 1] },
  { who: 'JM', days: [0, 1, 1, 0] },
];

export function TogetherDemo() {
  const ref = useRef(null);
  const [phase] = usePlayhead(useInView(ref), TOGETHER_HOLDS);
  const messages = DEMO_THREAD.slice(0, Math.max(0, phase - 1));

  return (
    <div className={'lp-room' + (phase >= 1 ? ' is-on' : '')} ref={ref}>
      <div className="lp-room__head">
        <span className="lp-room__title">Morning run</span>
        <span className="lp-room__meta">Shared · 4× weekly</span>
      </div>
      <ul className="lp-room__people">
        {MEMBERS.map((m, r) => (
          <li key={m.who} className="lp-room__person">
            <span className="lp-disc" aria-hidden="true">{m.who === 'You' ? 'Y' : m.who}</span>
            <span className="lp-room__name">{m.who}</span>
            <ol className="lp-room__days">
              {DAYS.map((d, i) => (
                <li
                  key={DAY_NAMES[i]}
                  className={'lp-sq' + (m.days[i] ? ' is-done' : '') + (i > TODAY ? ' is-ahead' : '')}
                  style={{ '--i': r * 4 + i }}
                  aria-label={`${DAY_NAMES[i]}: ${m.days[i] ? 'done' : 'not done'}`}
                />
              ))}
            </ol>
            <span className="lp-room__count">{m.days.reduce((s, v) => s + v, 0)}</span>
          </li>
        ))}
      </ul>
      <div className="lp-room__thread" aria-live="polite">
        {messages.map((msg) => (
          <div key={msg.text} className={'lp-msg lp-rise' + (msg.who === 'You' ? ' lp-msg--mine' : '')}>
            {msg.who !== 'You' && <span className="lp-disc lp-disc--sm" aria-hidden="true">{msg.who}</span>}
            <p className="lp-msg__bubble">
              <span className="app-sr">{msg.who}: </span>
              {msg.text}
            </p>
          </div>
        ))}
      </div>
      <Illustrative />
    </div>
  );
}

/* ── Starts focused: modules switched on one by one ──────── */

const FOCUSED_HOLDS = [700, 550, 550, 550];
const SHOWN_MODULES = MODULES.slice(0, 6);

export function FocusedDemo() {
  const ref = useRef(null);
  const [phase] = usePlayhead(useInView(ref), FOCUSED_HOLDS);

  return (
    <div className="lp-sheet lp-modules" ref={ref}>
      <p className="lp-sheet__title">What Mordi shows</p>
      <span className="lp-segments lp-segments--two" aria-hidden="true">
        <span className="lp-segments__thumb" style={{ '--n': 2, '--i': 0 }} />
        <span className="lp-segment is-on">Focused</span>
        <span className="lp-segment">Everything</span>
      </span>
      <ul className="lp-modules__list">
        {SHOWN_MODULES.map((m, i) => {
          const on = i < phase;
          return (
            <li key={m.id} className="lp-modules__row">
              <span>
                <span className="lp-modules__name">{m.label}</span>
                <span className="lp-modules__blurb">{m.blurb}</span>
              </span>
              <span className={'lp-switch' + (on ? ' is-on' : '')} role="img" aria-label={on ? 'On' : 'Off'} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── Small glyphs for the "more" grid ────────────────────── */

const ACTIVITY = Array.from({ length: 84 }, (_, i) => {
  // A fixed pattern, so the picture is the same on every visit.
  const v = (i * 37 + (i % 7) * 11) % 9;
  return v > 6 ? 3 : v > 4 ? 2 : v > 1 ? 1 : 0;
});

export function MoreGlyph({ id }) {
  switch (id) {
    case 'timer':
      return (
        <div className="lp-g lp-g--timer" aria-hidden="true">
          <Ring value={24} target={60} size={84} />
          <span className="lp-g__digits">24:10</span>
        </div>
      );
    case 'calendar':
      return (
        <div className="lp-g lp-g--cal" aria-hidden="true">
          {[0, 1, 2, 3].map((h) => <span key={h} className="lp-g__hour" />)}
          <span className="lp-g__block" style={{ '--top': 0, '--h': 1, '--i': 0 }}>Deep work</span>
          <span className="lp-g__block lp-g__block--alt" style={{ '--top': 2, '--h': 1.5, '--i': 1 }}>Gym</span>
        </div>
      );
    case 'notes':
      return (
        <div className="lp-g lp-g--notes" aria-hidden="true">
          <p className="lp-g__h">Reading list</p>
          <p><span className="lp-g__box is-done" />[[Dune]]</p>
          <p><span className="lp-g__box" />[[The Overstory]]</p>
          <p className="lp-g__tag">#books</p>
        </div>
      );
    case 'activity':
      return (
        <div className="lp-g lp-g--activity" aria-hidden="true">
          {ACTIVITY.map((v, i) => (
            <span key={i} className={`lp-g__sq lp-g__sq--${v}`} style={{ '--i': i }} />
          ))}
        </div>
      );
    case 'history':
      return (
        <div className="lp-g lp-g--history" aria-hidden="true">
          {[
            { title: 'Couch to 5k', meta: '12 weeks · 41 of 48', i: 0 },
            { title: 'No phone after 10', meta: '6 weeks · 33 of 42', i: 1 },
          ].map((g) => (
            <div key={g.title} className="lp-g__archived" style={{ '--i': g.i }}>
              <span>
                <span className="lp-g__atitle">{g.title}</span>
                <span className="lp-g__ameta">{g.meta}</span>
              </span>
              <span className="lp-g__restore">Restore</span>
            </div>
          ))}
        </div>
      );
    case 'places':
      return (
        <div className="lp-g lp-g--map" aria-hidden="true">
          <span className="lp-g__road lp-g__road--a" />
          <span className="lp-g__road lp-g__road--b" />
          <span className="lp-g__pin" />
          <span className="lp-g__place">Riverside path</span>
        </div>
      );
    default:
      return null;
  }
}

/* ── The color combinations, live ───────────────────────── */

export function ThemePicker({ theme, onPick }) {
  return (
    <div className="lp-themes">
      {['light', 'dark'].map((scheme) => (
        <div key={scheme} className="lp-themes__group" role="group" aria-label={scheme === 'light' ? 'Light' : 'Dark'}>
          <p className="lp-themes__heading">{scheme === 'light' ? 'Light' : 'Dark'}</p>
          <div className="lp-themes__row">
            {THEMES.filter((t) => t.scheme === scheme).map((t) => (
              <button
                key={t.id}
                type="button"
                className="lp-swatch"
                aria-pressed={t.id === theme}
                onClick={() => onPick(t.id)}
              >
                <span className="lp-swatch__face" data-theme={t.id} aria-hidden="true">
                  <span className="lp-swatch__dot" />
                </span>
                <span className="lp-swatch__label">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
