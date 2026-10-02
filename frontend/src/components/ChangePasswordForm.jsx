import { useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/useAuth';

/**
 * Inside the Account panel on Settings. Changing the password signs every
 * device out; this one stays in on the fresh session the server sends back
 * with the reply, so the page does not bounce to sign-in.
 */
export default function ChangePasswordForm() {
  const { login } = useAuth();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    setOpen(false);
    setCurrent('');
    setNext('');
    setConfirm('');
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (next !== confirm) {
      setError('The two new passwords don’t match.');
      return;
    }
    setBusy(true);
    try {
      const res = await client.put('/api/account/password', { currentPassword: current, newPassword: next });
      login({ email: res.data.email, name: res.data.name }, res.data.token);
      close();
      setDone('Password changed. Every other device has been signed out.');
    } catch (err) {
      const data = err?.response?.data;
      setError(
        err?.response?.status === 400
          ? (data?.fieldErrors?.newPassword ?? data?.error ?? 'That didn’t work. Check the current password.')
          : 'Couldn’t change the password. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <>
        <div className="settings__actions">
          <button
            type="button"
            className="app-btn app-btn--quiet"
            onClick={() => {
              setDone('');
              setOpen(true);
            }}
          >
            Change password
          </button>
        </div>
        <div role="status">{done && <p className="settings__status">{done}</p>}</div>
      </>
    );
  }

  return (
    <form className="app-form" onSubmit={submit}>
      <div className="app-field">
        <label htmlFor="pw-current">Current password</label>
        <input
          id="pw-current"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </div>
      <div className="app-field">
        <label htmlFor="pw-next">New password</label>
        <input
          id="pw-next"
          type="password"
          autoComplete="new-password"
          aria-describedby="pw-next-hint"
          minLength={8}
          maxLength={72}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
        <p id="pw-next-hint" className="app-field__hint">
          At least 8 characters. Other devices will be signed out.
        </p>
      </div>
      <div className="app-field">
        <label htmlFor="pw-confirm">Confirm new password</label>
        <input
          id="pw-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      {error && (
        <p className="app-form__error" role="alert">
          {error}
        </p>
      )}
      <div className="app-form__actions">
        <button type="button" className="app-btn app-btn--ghost" onClick={close} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="app-btn" disabled={busy}>
          {busy ? 'Saving…' : 'Save new password'}
        </button>
      </div>
    </form>
  );
}
