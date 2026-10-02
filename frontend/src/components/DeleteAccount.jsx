import { startTransition, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/useAuth';

/**
 * The last panel on Settings. Says plainly what goes and what stays, then asks
 * for the password before anything happens: deletion is immediate and cannot
 * be undone, so it takes two deliberate steps.
 */
export default function DeleteAccount() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const cancel = () => {
    setOpen(false);
    setPassword('');
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await client.delete('/api/account', { data: { password } });
      // One transition for both. Signed out on its own, this page's private
      // route would redirect to sign-in first and the notice would be lost:
      // the router applies navigate() as a transition, behind the urgent
      // sign-out.
      startTransition(() => {
        logout();
        navigate('/login', {
          replace: true,
          state: { notice: 'Your account has been deleted. A confirmation is on its way to your inbox.' },
        });
      });
    } catch (err) {
      const status = err?.response?.status;
      setError(
        status === 400
          ? 'That password isn’t right.'
          : status === 429
            ? 'Too many tries. Wait a minute, then try again.'
            : 'Couldn’t delete the account. Check your connection and try again.',
      );
      setBusy(false);
    }
  };

  return (
    <section className="app-panel" aria-labelledby="set-delete">
      <div className="app-panel__head">
        <h2 className="app-panel__title" id="set-delete">
          Delete account
        </h2>
      </div>
      <p className="settings__note">
        Deletes your account and everything in it straight away: goals, entries, places, notes, to-dos, events,
        and your messages in shared goals. It can&rsquo;t be undone. Goals you share pass to whoever joined them
        first. If you want a copy, download your data first.
      </p>

      {open ? (
        <form className="app-form" onSubmit={submit}>
          <div className="app-field">
            <label htmlFor="delete-password">Your password</label>
            <input
              id="delete-password"
              type="password"
              autoComplete="current-password"
              aria-describedby="delete-password-hint"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p id="delete-password-hint" className="app-field__hint">
              To confirm it&rsquo;s you.
            </p>
          </div>
          {error && (
            <p className="app-form__error" role="alert">
              {error}
            </p>
          )}
          <div className="app-form__actions">
            <button type="button" className="app-btn app-btn--ghost" onClick={cancel} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="app-btn app-btn--danger" disabled={busy}>
              {busy ? 'Deleting…' : 'Delete permanently'}
            </button>
          </div>
        </form>
      ) : (
        <div className="settings__actions">
          <button type="button" className="app-btn app-btn--danger" onClick={() => setOpen(true)}>
            Delete my account…
          </button>
        </div>
      )}
    </section>
  );
}
