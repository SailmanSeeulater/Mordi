import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { returnPath } from '../lib/returnTo';
import { track } from '../lib/analytics';
import { useAuth } from '../context/useAuth';
import client from '../api/client';
import TermsConsent from './TermsConsent';
import './app.css';

/**
 * The create-account form, one implementation for the /register page and the
 * landing page's account dialog, so the two cannot drift. A new account goes
 * back to the page that sent the person here (an invite link, say), or to the
 * dashboard.
 */
export default function RegisterForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await client.post('/api/auth/register', { name, email, password });
      login({ email: res.data.email, name: res.data.name }, res.data.token);
      track('Sign up');
      navigate(returnPath(location.state), { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      setError(
        status === 409
          ? 'Couldn’t create the account. If you already have one with this email, sign in instead.'
          : status === 429
            ? 'Too many tries. Wait a minute, then try again.'
            : status === 400
              ? 'Check the name, email and password, then try again.'
              : 'Couldn’t create the account just now. Check your connection and try again in a moment.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="app-form" onSubmit={handleSubmit}>
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
          aria-describedby="register-password-hint"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <p id="register-password-hint" className="app-field__hint">
          At least 8 characters.
        </p>
      </div>
      {error && (
        <p className="app-form__error" role="alert">
          {error}
        </p>
      )}
      <TermsConsent />
      <button className="app-btn app-btn--block" type="submit" disabled={submitting}>
        {submitting ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}
