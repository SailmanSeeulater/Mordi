import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';
import useDocumentTitle from '../hooks/useDocumentTitle';
import client from '../api/client';
import Modal from '../components/Modal';
import './landing.css';

const TASKS = [
  { label: 'Ship landing page draft', done: false, tag: 'High', tone: 'accent' },
  { label: 'Morning run — 5k', done: true, tag: 'Habit', tone: 'neutral' },
  { label: 'Call the dentist', done: false, tag: 'Low', tone: 'outline' },
  { label: 'Review project notes', done: false, tag: 'Medium', tone: 'neutral' },
  { label: 'Reply to client email', done: false, tag: 'Low', tone: 'outline' },
  { label: 'Pay rent', done: false, tag: 'High', tone: 'accent' },
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
  const { theme } = useTheme();
  const navigate = useNavigate();

  useScrollReveal();

  useEffect(() => {
    document.body.classList.add('mordi-landing');
    return () => document.body.classList.remove('mordi-landing');
  }, []);

  const openAuth = (tab) => {
    setAuthTab(tab);
    setError('');
    setAuthOpen(true);
  };

  // Declared before the effect that uses it, and memoised, so the listener is
  // attached to a stable function rather than a new one on every render.
  const closeAuth = useCallback(() => {
    setAuthOpen(false);
    setError('');
    setName('');
    setEmail('');
    setPassword('');
  }, []);


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
    <div className="mordi-page" data-theme={theme}>

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
        <Modal
          title={authTab === 'signin' ? 'Sign in' : 'Create your account'}
          onClose={closeAuth}
        >
          {/* The same sliding segmented control the goal form uses, so the
              public site and the app switch between two options the same way. */}
          <div className="auth-switch">
            <div className="app-segments" role="group" aria-label="Account">
              <span
                className="app-segments__thumb"
                style={{ '--n': 2, '--i': authTab === 'signin' ? 0 : 1 }}
                aria-hidden="true"
              />
              <button
                type="button"
                className="app-segment"
                aria-pressed={authTab === 'signin'}
                onClick={() => switchTab('signin')}
              >
                Sign in
              </button>
              <button
                type="button"
                className="app-segment"
                aria-pressed={authTab === 'register'}
                onClick={() => switchTab('register')}
              >
                Create account
              </button>
            </div>
          </div>

          {authTab === 'signin' ? (
            <form className="app-form" onSubmit={handleSignIn}>
              {error && (
                <p className="app-form__error" role="alert">
                  {error}
                </p>
              )}
              <div className="app-field">
                <label htmlFor="signin-email">Email</label>
                <input
                  id="signin-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="app-field">
                <label htmlFor="signin-password">Password</label>
                <input
                  id="signin-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="app-form__actions">
                <button type="submit" className="app-btn app-btn--block" disabled={submitting}>
                  {submitting ? 'Signing in…' : 'Sign in'}
                </button>
              </div>
            </form>
          ) : (
            <form className="app-form" onSubmit={handleRegister}>
              {error && (
                <p className="app-form__error" role="alert">
                  {error}
                </p>
              )}
              <div className="app-field">
                <label htmlFor="register-name">Name</label>
                <input
                  id="register-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Ada Lovelace"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="app-field">
                <label htmlFor="register-email">Email</label>
                <input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="app-field">
                <label htmlFor="register-password">Password</label>
                <input
                  id="register-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <p className="app-field__hint">At least 8 characters.</p>
              </div>
              <div className="app-form__actions">
                <button type="submit" className="app-btn app-btn--block" disabled={submitting}>
                  {submitting ? 'Creating account…' : 'Create account'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}