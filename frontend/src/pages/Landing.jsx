import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { prefersReducedMotion, useInView } from '../hooks/useLandingMotion';
import client from '../api/client';
import Modal from '../components/Modal';
import TermsConsent from '../components/TermsConsent';
import {
  HeroWeekDemo,
  GoalDemo,
  LogDemo,
  WeekRuleDemo,
  ReportDemo,
  ReminderDemo,
  TodoDemo,
  TogetherDemo,
  FocusedDemo,
  MoreGlyph,
  ThemePicker,
} from './LandingDemos';
import {
  NAV,
  HERO,
  HOW,
  REPORT,
  REMINDERS,
  TODOS,
  TOGETHER,
  FOCUSED,
  MORE,
  THEMES_COPY,
  DATA,
  FAQ,
  CLOSE,
  FOOTER,
} from './landingCopy';
import './landing.css';

const STEP_DEMOS = [GoalDemo, LogDemo, WeekRuleDemo];
const STEP_MS = 6500;

/**
 * Three steps beside one demo. While the section is on screen the steps
 * advance on their own, each with a bar that fills over its time; choosing a
 * step, or Pause, hands control to the person and it stays with them.
 */
function HowItWorks() {
  const ref = useRef(null);
  const inView = useInView(ref, 0.3);
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(() => !prefersReducedMotion());
  const running = auto && inView;

  useEffect(() => {
    if (!running) return undefined;
    const t = setTimeout(() => setStep((s) => (s + 1) % HOW.steps.length), STEP_MS);
    return () => clearTimeout(t);
  }, [running, step]);

  const choose = (i) => {
    setAuto(false);
    setStep(i);
  };

  const onKeyDown = (e) => {
    const n = HOW.steps.length;
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (step + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : n - 1)) % n;
    choose(next);
    document.getElementById(`how-tab-${next}`)?.focus();
  };

  const Demo = STEP_DEMOS[step];

  return (
    <section className="lp-section" id="how" aria-labelledby="how-title" ref={ref}>
      <div className="lp-head" data-reveal>
        <h2 className="lp-h2" id="how-title">{HOW.title}</h2>
        <p className="lp-lede">{HOW.sub}</p>
      </div>

      <div className="lp-how" data-reveal>
        <div className="lp-how__steps">
          <div role="tablist" aria-label={HOW.title} aria-orientation="vertical" onKeyDown={onKeyDown}>
            {HOW.steps.map((s, i) => (
              <button
                key={s.id}
                id={`how-tab-${i}`}
                type="button"
                role="tab"
                aria-selected={i === step}
                aria-controls="how-panel"
                tabIndex={i === step ? 0 : -1}
                className={'lp-step' + (i === step ? ' is-active' : '')}
                onClick={() => choose(i)}
              >
                <span className="lp-step__num" aria-hidden="true">{i + 1}</span>
                <span className="lp-step__text">
                  <span className="lp-step__title">{s.title}</span>
                  <span className="lp-step__body">{s.body}</span>
                </span>
                {i === step && (
                  <span
                    key={`${step}-${running}`}
                    className={'lp-step__progress' + (running ? ' is-running' : '')}
                    style={{ '--ms': `${STEP_MS}ms` }}
                    aria-hidden="true"
                  />
                )}
              </button>
            ))}
          </div>
          {auto && (
            <button type="button" className="lp-replay lp-how__pause" onClick={() => setAuto(false)}>
              {HOW.pause}
            </button>
          )}
        </div>

        <div className="lp-how__stage" id="how-panel" role="tabpanel" aria-labelledby={`how-tab-${step}`}>
          <Demo key={step} />
          <p className="lp-illus">Illustrative example</p>
        </div>
      </div>
    </section>
  );
}

/** A feature row: words on one side, its demo on the other. */
function Row({ id, title, body, aside, points, flip, children }) {
  return (
    <section className={'lp-section lp-row' + (flip ? ' lp-row--flip' : '')} id={id} aria-labelledby={`${id}-title`}>
      <div className="lp-row__text" data-reveal>
        <h2 className="lp-h2" id={`${id}-title`}>{title}</h2>
        <p className="lp-lede">{body}</p>
        {points && (
          <ul className="lp-points">
            {points.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
        {aside && <p className="lp-aside">{aside}</p>}
      </div>
      <div className="lp-row__demo" data-reveal>
        {children}
      </div>
    </section>
  );
}

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
  const { theme, setTheme } = useTheme();
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
      <a className="lp-skip" href="#main">Skip to content</a>

      <nav className="mordi-nav" aria-label="Main">
        <button
          type="button"
          className="mordi-nav__brand"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          Mordi
        </button>
        <div className="lp-nav__links">
          {NAV.links.map((l) => (
            <a key={l.href} href={l.href}>{l.label}</a>
          ))}
        </div>
        <div className="mordi-nav__actions">
          <button type="button" className="btn-text" onClick={() => openAuth('signin')}>
            {NAV.signIn}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => openAuth('register')}>
            {NAV.signUp}
          </button>
        </div>
      </nav>

      <main id="main" className="mordi-container">
        <section className="lp-hero" aria-labelledby="hero-title">
          <h1 className="lp-hero__title" id="hero-title">
            {HERO.title.split('. ').map((line, i, all) => (
              <span key={line} className="lp-hero__line" style={{ '--i': i }}>
                {i < all.length - 1 ? `${line}.` : line}
              </span>
            ))}
          </h1>
          <p className="lp-hero__sub">{HERO.sub}</p>
          <div className="lp-hero__actions">
            <button type="button" className="btn btn-primary" onClick={() => openAuth('register')}>
              {HERO.primary}
            </button>
            <a className="btn btn-ghost" href="#how">{HERO.secondary}</a>
          </div>
          <div className="lp-hero__stage">
            <HeroWeekDemo />
          </div>
        </section>

        <HowItWorks />

        <Row id="report" title={REPORT.title} body={REPORT.body} aside={REPORT.aside}>
          <ReportDemo />
        </Row>

        <Row id="reminders" title={REMINDERS.title} body={REMINDERS.body} points={REMINDERS.points} aside={REMINDERS.aside} flip>
          <ReminderDemo />
        </Row>

        <Row id="todos" title={TODOS.title} body={TODOS.body} aside={TODOS.aside}>
          <TodoDemo />
        </Row>

        <Row id="together" title={TOGETHER.title} body={TOGETHER.body} points={TOGETHER.points} flip>
          <TogetherDemo />
        </Row>

        <Row id="focused" title={FOCUSED.title} body={FOCUSED.body}>
          <FocusedDemo />
        </Row>

        <section className="lp-section" id="more" aria-labelledby="more-title">
          <div className="lp-head" data-reveal>
            <h2 className="lp-h2" id="more-title">{MORE.title}</h2>
          </div>
          <ul className="lp-more">
            {MORE.items.map((item, i) => (
              <li key={item.id} className="lp-more__item" data-reveal style={{ '--d': `${(i % 3) * 80}ms` }}>
                <div className="lp-more__visual">
                  <MoreGlyph id={item.id} />
                </div>
                <h3 className="lp-h3">{item.title}</h3>
                <p>{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="lp-section lp-row" id="colors" aria-labelledby="colors-title">
          <div className="lp-row__text" data-reveal>
            <h2 className="lp-h2" id="colors-title">{THEMES_COPY.title}</h2>
            <p className="lp-lede">{THEMES_COPY.body}</p>
          </div>
          <div className="lp-row__demo" data-reveal>
            <ThemePicker theme={theme} onPick={setTheme} />
          </div>
        </section>

        <section className="lp-section" id="data" aria-labelledby="data-title">
          <div className="lp-head" data-reveal>
            <h2 className="lp-h2" id="data-title">{DATA.title}</h2>
          </div>
          <ul className="lp-data">
            {DATA.points.map((p, i) => (
              <li key={p.title} data-reveal style={{ '--d': `${i * 80}ms` }}>
                <h3 className="lp-h3">{p.title}</h3>
                <p>{p.body}</p>
              </li>
            ))}
          </ul>
          <p className="lp-data__links" data-reveal>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
          </p>
        </section>

        <section className="lp-section lp-faq" id="faq" aria-labelledby="faq-title">
          <div className="lp-head" data-reveal>
            <h2 className="lp-h2" id="faq-title">{FAQ.title}</h2>
          </div>
          <div className="lp-faq__list" data-reveal>
            {FAQ.items.map((item) => (
              <details key={item.q} className="lp-faq__item">
                <summary>
                  {item.q}
                  <span className="lp-faq__icon" aria-hidden="true" />
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <section className="mordi-close" data-reveal aria-labelledby="close-title">
        <div className="mordi-close__inner">
          <h2 className="mordi-close__title" id="close-title">{CLOSE.title}</h2>
          <p className="lp-close__sub">{CLOSE.sub}</p>
          <div className="mordi-close__actions">
            <button
              type="button"
              className="btn btn-ghost btn-ghost--invert"
              onClick={() => openAuth('register')}
            >
              {CLOSE.cta}
            </button>
          </div>
        </div>
      </section>

      <footer className="mordi-footer">
        <div className="mordi-footer__cols">
          <div className="mordi-footer__col">
            <span className="mordi-footer__heading">{FOOTER.product}</span>
            {NAV.links.map((l) => (
              <a key={l.href} href={l.href}>{l.label}</a>
            ))}
          </div>
          <div className="mordi-footer__col">
            <span className="mordi-footer__heading">{FOOTER.account}</span>
            <button type="button" className="lp-footer__btn" onClick={() => openAuth('signin')}>
              {NAV.signIn}
            </button>
            <button type="button" className="lp-footer__btn" onClick={() => openAuth('register')}>
              {CLOSE.cta}
            </button>
            <Link to="/forgot-password">Forgot password</Link>
          </div>
          <div className="mordi-footer__col">
            <span className="mordi-footer__heading">{FOOTER.legal}</span>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </div>
        </div>
        <span className="mordi-footer__copy">{FOOTER.copyright}</span>
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
              <TermsConsent />
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