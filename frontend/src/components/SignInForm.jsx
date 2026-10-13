import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { returnPath } from '../lib/returnTo';
import { useAuth } from '../context/useAuth';
import client from '../api/client';
import './app.css';
import './auth.css';

/**
 * The sign-in form, one implementation for the /login page and the landing
 * page's account dialog, so the two cannot drift. Signing in goes back to the
 * page that sent the person here (an invite link, say), or to the dashboard.
 *
 * `notice` is good news handed over by another page ("your password has been
 * changed"), shown above the fields.
 */
export default function SignInForm({ notice }) {
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
      const res = await client.post('/api/auth/login', { email, password });
      login({ email: res.data.email, name: res.data.name }, res.data.token);
      navigate(returnPath(location.state), { replace: true });
    } catch {
      setError('That email and password don’t match. Check both and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="app-form" onSubmit={handleSubmit}>
      {notice && (
        <p className="app-form__notice" role="status">
          {notice}
        </p>
      )}
      <div className="app-field">
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="app-field">
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <p className="auth__aside">
          <Link to="/forgot-password">Forgot your password?</Link>
        </p>
      </div>
      {error && (
        <p className="app-form__error" role="alert">
          {error}
        </p>
      )}
      <button className="app-btn app-btn--block" type="submit" disabled={submitting}>
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
