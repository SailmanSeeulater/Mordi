import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { returnPath } from "../lib/returnTo";
import { useAuth } from "../context/useAuth";
import useDocumentTitle from "../hooks/useDocumentTitle";
import client from "../api/client";
import AuthPage from "../components/AuthPage";

export default function Register() {
  useDocumentTitle("Create account");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await client.post("/api/auth/register", {
        name,
        email,
        password,
      });
      login({ email: res.data.email, name: res.data.name }, res.data.token);
      navigate(returnPath(location.state), { replace: true });
    } catch {
      setError("Registration failed. Email may already be in use.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPage
      title="Create your account"
      footer={
        <>
          Already have an account? <Link to="/login" state={location.state}>Sign in</Link>
        </>
      }
    >
      <form className="app-form" onSubmit={handleSubmit}>
        <div className="app-field">
          <label htmlFor="register-name">Name</label>
          <input
            id="register-name"
            type="text"
            autoComplete="name"
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
        <button className="app-btn app-btn--block" type="submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthPage>
  );
}
