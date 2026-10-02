import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { readResetToken } from "../lib/account";
import { useAuth } from "../context/useAuth";
import useDocumentTitle from "../hooks/useDocumentTitle";
import client from "../api/client";
import AuthPage from "../components/AuthPage";

const signInFooter = (
  <>
    Remembered it? <Link to="/login">Sign in</Link>
  </>
);

/**
 * Where the emailed link lands: /reset-password#<token>. A good token shows
 * the form; a missing, used or expired one explains and offers a new link.
 * Setting the password signs every device out, so this one goes back to
 * sign in rather than straight into the app.
 */
export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const token = readResetToken(location.hash);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expired, setExpired] = useState(!token);
  useDocumentTitle(expired ? "This link has expired" : "Choose a new password");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("The two passwords don’t match.");
      return;
    }
    setSubmitting(true);
    try {
      await client.post("/api/auth/reset", { token, password });
      // Every session was just ended on the server; a stale one in this
      // browser would only bounce between pages until it noticed.
      if (user) logout();
      navigate("/login", {
        replace: true,
        state: { notice: "Your password has been changed. Sign in with the new one." },
      });
    } catch (err) {
      const status = err?.response?.status;
      if (status === 410) {
        setExpired(true);
      } else if (status === 400) {
        setError(err.response.data?.fieldErrors?.password ?? "That password can’t be used. Try another.");
      } else {
        setError("Couldn’t change the password. Check your connection and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (expired) {
    return (
      <AuthPage title="This link has expired" footer={signInFooter}>
        <div className="app-form">
          <p className="auth__lead">
            Reset links work once, for 30 minutes, and only the latest one sent. Ask for a new one
            and open it from the newest email.
          </p>
          <Link className="app-btn app-btn--block" to="/forgot-password">
            Request a new link
          </Link>
        </div>
      </AuthPage>
    );
  }

  return (
    <AuthPage title="Choose a new password" footer={signInFooter}>
      <form className="app-form" onSubmit={handleSubmit}>
        <div className="app-field">
          <label htmlFor="reset-password">New password</label>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            aria-describedby="reset-password-hint"
            minLength={8}
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p id="reset-password-hint" className="app-field__hint">
            At least 8 characters.
          </p>
        </div>
        <div className="app-field">
          <label htmlFor="reset-confirm">Confirm new password</label>
          <input
            id="reset-confirm"
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
        <button className="app-btn app-btn--block" type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Change password"}
        </button>
      </form>
    </AuthPage>
  );
}
