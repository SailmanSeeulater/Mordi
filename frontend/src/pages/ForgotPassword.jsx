import { useState } from "react";
import { Link } from "react-router-dom";
import useDocumentTitle from "../hooks/useDocumentTitle";
import client from "../api/client";
import AuthPage from "../components/AuthPage";

/**
 * Asks for an address and says the same thing whether or not it has an
 * account: the server does too, so neither can be used to find out which
 * addresses are registered.
 */
export default function ForgotPassword() {
  useDocumentTitle("Reset your password");

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await client.post("/api/auth/forgot", { email });
      setSent(true);
    } catch (err) {
      setError(
        err?.response?.status === 429
          ? "Too many tries. Wait a minute, then try again."
          : "Couldn’t send the link. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPage
      title="Reset your password"
      footer={
        <>
          Remembered it? <Link to="/login">Sign in</Link>
        </>
      }
    >
      {sent ? (
        <div className="app-form">
          <p className="auth__done" role="status">
            If <strong>{email}</strong> has an account, a link to choose a new password is on its way.
            It works for 30 minutes.
          </p>
          <p className="app-field__hint">
            Nothing arrived? Check the spam folder, or{" "}
            <button type="button" className="auth__linkbtn" onClick={() => setSent(false)}>
              try another address
            </button>
            .
          </p>
        </div>
      ) : (
        <form className="app-form" onSubmit={handleSubmit}>
          <p className="auth__lead">Enter the address you signed up with and we’ll email you a link.</p>
          <div className="app-field">
            <label htmlFor="forgot-email">Email</label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {error && (
            <p className="app-form__error" role="alert">
              {error}
            </p>
          )}
          <button className="app-btn app-btn--block" type="submit" disabled={submitting}>
            {submitting ? "Sending…" : "Email me a link"}
          </button>
        </form>
      )}
    </AuthPage>
  );
}
