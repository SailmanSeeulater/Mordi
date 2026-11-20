import { useState } from 'react';
import { useAuth } from '../context/useAuth';
import client from '../api/client';
import { track } from '../lib/analytics';
import { sessionUser } from '../lib/guest';
import TermsConsent from './TermsConsent';
import './app.css';

/**
 * Turns a guest ("Try it") account into a real one: the person's own name,
 * email and password, and everything made in the demo stays. The same fields
 * and wording as RegisterForm, since to the person it is signing up.
 */
export default function SaveAccountForm({ onSaved }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await client.post('/api/account/claim', { name, email, password });
      login(sessionUser(res.data), res.data.token);
      track('Sign up');
      onSaved?.();
    } catch (err) {
      const status = err?.response?.status;
      setError(
        status === 409
          ? 'There’s already an account with this email. Use another address, or sign in to that one (this demo will be lost).'
          : status === 429
            ? 'Too many tries. Wait a minute, then try again.'
            : status === 400
              ? err.response.data?.error === 'Use your own email address'
                ? 'Use your own email address.'
                : 'Check the name, email and password, then try again.'
              : 'Couldn’t save the account just now. Check your connection and try again in a moment.',
      );
      setSubmitting(false);
    }
  };

  return (
    <form className="app-form" onSubmit={handleSubmit}>
      <div className="app-field">
        <label htmlFor="save-name">Name</label>
        <input
          id="save-name"
          type="text"
          autoComplete="name"
          placeholder="Ada Lovelace"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="app-field">
        <label htmlFor="save-email">Email</label>
        <input
          id="save-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="app-field">
        <label htmlFor="save-password">Password</label>
        <input
          id="save-password"
          type="password"
          autoComplete="new-password"
          aria-describedby="save-password-hint"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <p id="save-password-hint" className="app-field__hint">
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
        {submitting ? 'Saving…' : 'Save my account'}
      </button>
    </form>
  );
}
