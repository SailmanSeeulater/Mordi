import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import useDocumentTitle from '../hooks/useDocumentTitle';
import client from '../api/client';
import './landing.css';

const TASKS = [
  { label: 'Ship landing page draft', done: false, tag: 'High', tone: 'accent' },
  { label: 'Morning run — 5k', done: true, tag: 'Habit', tone: 'neutral' },
  { label: 'Call the dentist', done: false, tag: 'Low', tone: 'outline' },
  { label: 'Review project notes', done: false, tag: 'Medium', tone: 'neutral' },
  { label: 'Reply to client email', done: false, tag: 'Low', tone: 'outline' },
  { label: 'Pay rent', done: false, tag: 'High', tone: 'accent' },
];

const WHY = [
  {
    n: '01',
    title: 'Most task lists get abandoned',
    body: 'They ask you to maintain the system before it helps you do the work — tagging, sorting, re-prioritizing. Most people quit within a week.',
  },
  {
    n: '02',
    title: 'Mordi keeps the list moving on its own',
    body: 'Habits and recurring tasks resurface themselves. Dates put things on your calendar automatically. You add tasks — Mordi handles the upkeep.',
  },
  {
    n: '03',
    title: 'One view, not five apps',
    body: 'Tasks, calendar, notes, and priorities live together — so you stop switching between a to-do app, a calendar, and a notes app to plan one day.',
  },
];

const IconLists = () => (
  <svg className="mordi-feature__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 6h13M8 12h13M8 18h13" />
    <path d="M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
);
const IconCalendar = () => (
  <svg className="mordi-feature__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="0" />
    <path d="M3 10h18M8 2v4M16 2v4" />
  </svg>
);
const IconRepeat = () => (
  <svg className="mordi-feature__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);
const IconTag = () => (
  <svg className="mordi-feature__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21.2 15.2a2 2 0 0 1 0 2.8l-2.2 2.2a2 2 0 0 1-2.8 0L3 7V3h4l13.2 13.2z" />
    <path d="M7 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
  </svg>
);
const IconLink = () => (
  <svg className="mordi-feature__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l8.49-8.49a3.5 3.5 0 0 1 4.95 4.95l-8.49 8.49a2 2 0 0 1-2.83-2.83l7.78-7.78" />
  </svg>
);
const IconGrid = () => (
  <svg className="mordi-feature__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
);

const FEATURES = [
  { Icon: IconLists, title: 'Lists & projects', body: 'Group tasks into projects and reorder freely.' },
  { Icon: IconCalendar, title: 'Calendar view', body: 'See a day, week, or month at a glance.' },
  { Icon: IconRepeat, title: 'Recurring habits', body: 'Set a task once, on your own schedule.' },
  { Icon: IconTag, title: 'Priorities & tags', body: 'Three levels, sort by what matters.' },
  { Icon: IconLink, title: 'Notes & attachments', body: 'Keep files and links on the task itself.' },
  { Icon: IconGrid, title: 'One view for everything', body: 'No switching between apps to plan a day.' },
];

function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]');

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach((el) => el.classList.add('is-revealed'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

export default function Landing() {
  useDocumentTitle(); 

  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState('signin'); // 'signin' | 'register'
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  useScrollReveal();

  useEffect(() => {
    document.body.classList.add('mordi-landing');
    return () => document.body.classList.remove('mordi-landing');
  }, []);

  useEffect(() => {
    if (!authOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeAuth();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [authOpen]);

  const openAuth = (tab) => {
    setAuthTab(tab);
    setError('');
    setAuthOpen(true);
  };

  const closeAuth = () => {
    setAuthOpen(false);
    setError('');
    setName('');
    setEmail('');
    setPassword('');
  };

  const switchTab = (tab) => {
    setAuthTab(tab);
    setError('');
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await client.post('/api/auth/login', { email, password });
      login({ email: res.data.email, name: res.data.name }, res.data.token);
      navigate('/dashboard');
    } catch (err) {
      console.error('Login failed:', err);
      setError('Invalid email or password');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await client.post('/api/auth/register', { name, email, password });
      login({ email: res.data.email, name: res.data.name }, res.data.token);
      navigate('/dashboard');
    } catch (err) {
      console.error('Registration failed:', err);
      setError('Registration failed. Email may already be in use.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mordi-page">
      <div className="mordi-noise" aria-hidden="true" />

      <nav className="mordi-nav">
        <button
          type="button"
          className="mordi-nav__brand"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          Mordi
        </button>
        <div className="mordi-nav__actions">
          <button type="button" className="btn-text" onClick={() => openAuth('signin')}>
            Sign in
          </button>
          <button type="button" className="btn btn-primary" onClick={() => openAuth('register')}>
            Sign up
          </button>
        </div>
      </nav>

      <div className="mordi-container">
        <section className="mordi-hero">
          <div>
            <h1 className="mordi-hero__title">A task tracker that actually gets used.</h1>
            <p className="mordi-hero__sub">
              Lists, calendar, habits, and notes in one clean view. No setup ritual, no busywork
              &mdash; just today&rsquo;s tasks, laid out clearly.
            </p>
            <div className="mordi-hero__actions">
              <button type="button" className="btn btn-primary" onClick={() => openAuth('register')}>
                Sign up
              </button>
            </div>
          </div>

          <div className="mordi-card">
            <div className="mordi-card__head">
              <span className="mordi-card__title">Today</span>
              <span className="mordi-card__date">Sep 8</span>
            </div>
            <div className="mordi-tasks__viewport">
              <div className="mordi-tasks__track">
                {[...TASKS, ...TASKS].map((t, i) => (
                  <div
                    key={`${t.label}-${i}`}
                    className={'mordi-task' + (t.done ? ' mordi-task--done' : '')}
                  >
                    <span
                      className={'mordi-task__box' + (t.done ? ' mordi-task__box--done' : '')}
                      aria-hidden="true"
                    />
                    <span className="mordi-task__label">{t.label}</span>
                    <span className={`tag tag-${t.tone}`}>{t.tag}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <hr className="mordi-rule" />

        <section className="mordi-why" data-reveal>
          <span className="mordi-kicker">Why Mordi</span>
          {WHY.map((w) => (
            <div className="mordi-why__row" key={w.n}>
              <p className="mordi-why__num">{w.n}</p>
              <div>
                <h3 className="mordi-why__title">{w.title}</h3>
                <p className="mordi-why__body">{w.body}</p>
              </div>
            </div>
          ))}
        </section>

        <hr className="mordi-rule" />

        <section className="mordi-features" id="features" data-reveal>
          <span className="mordi-kicker">Features</span>
          <h2 className="mordi-features__lede">
            Everything a personal tracker needs, nothing it doesn&rsquo;t
          </h2>
          <div className="mordi-features__grid">
            {FEATURES.map(({ Icon, title, body }) => (
              <div className="mordi-feature" key={title}>
                <Icon />
                <h3 className="mordi-feature__title">{title}</h3>
                <p className="mordi-feature__body">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <hr className="mordi-rule" />
      </div>

      <section className="mordi-close" data-reveal>
        <div className="mordi-close__inner">
          <h2 className="mordi-close__title">
            <span>Start tracking</span>
            <span>your day.</span>
          </h2>
          <div className="mordi-close__actions">
            <button
              type="button"
              className="btn btn-ghost btn-ghost--invert"
              onClick={() => openAuth('register')}
            >
              Sign up
            </button>
          </div>
        </div>
      </section>

      <footer className="mordi-footer">
        <div className="mordi-footer__cols">
          <div className="mordi-footer__col">
            <span className="mordi-footer__heading">Company</span>
            <Link to="/about">About</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </div>
        </div>
        <span className="mordi-footer__copy">&copy; 2026 Mordi.</span>
      </footer>

      {authOpen && (
        <div
          className="mordi-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeAuth();
          }}
        >
          <div
            className="mordi-slip"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mordi-slip-title"
          >
            <div className="mordi-slip__head">
              <span className="mordi-slip__label" id="mordi-slip-title">
                Mordi account
              </span>
              <button
                type="button"
                className="mordi-slip__close"
                onClick={closeAuth}
                aria-label="Close"
              >
                Close &times;
              </button>
            </div>

            <div className="mordi-slip__tabs">
              <button
                type="button"
                className={'mordi-slip__tab' + (authTab === 'signin' ? ' active' : '')}
                onClick={() => switchTab('signin')}
              >
                Sign in
              </button>
              <button
                type="button"
                className={'mordi-slip__tab' + (authTab === 'register' ? ' active' : '')}
                onClick={() => switchTab('register')}
              >
                Sign up
              </button>
            </div>

            <div className="mordi-slip__body">
              {error && <p className="mordi-slip__error">{error}</p>}

              {authTab === 'signin' ? (
                <form onSubmit={handleSignIn}>
                  <div className="mordi-field">
                    <label htmlFor="signin-email">Email</label>
                    <input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="mordi-field">
                    <label htmlFor="signin-password">Password</label>
                    <input
                      id="signin-password"
                      type="password"
                      placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary mordi-slip__submit"
                    disabled={submitting}
                  >
                    {submitting ? 'Signing in…' : 'Sign in'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegister}>
                  <div className="mordi-field">
                    <label htmlFor="register-name">Full name</label>
                    <input
                      id="register-name"
                      type="text"
                      placeholder="Ada Lovelace"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="mordi-field">
                    <label htmlFor="register-email">Email</label>
                    <input
                      id="register-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="mordi-field">
                    <label htmlFor="register-password">Password</label>
                    <input
                      id="register-password"
                      type="password"
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary mordi-slip__submit"
                    disabled={submitting}
                  >
                    {submitting ? 'Creating account…' : 'Sign up'}
                  </button>
                </form>
              )}
            </div>

            <div className="mordi-slip__foot">
              {authTab === 'signin'
                ? 'New here? Switch to "Sign up" above.'
                : 'Already have an account? Switch to "Sign in" above.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}