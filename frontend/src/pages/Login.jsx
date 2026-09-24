import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { returnPath } from "../lib/returnTo";
import { useAuth } from "../context/useAuth";
import useDocumentTitle from "../hooks/useDocumentTitle";
import client from "../api/client";
import AuthPage from "../components/AuthPage";

export default function Login() {
  useDocumentTitle("Sign in");

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
      const res = await client.post("/api/auth/login", { email, password });
      login({ email: res.data.email, name: res.data.name }, res.data.token);
      navigate(returnPath(location.state), { replace: true });
    } catch {
      setError("Invalid email or password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPage
      title="Sign in"
      footer={
        <>
          New to Mordi? <Link to="/register" state={location.state}>Create an account</Link>
        </>
      }
    >
      <form className="app-form" onSubmit={handleSubmit}>
        <div className="app-field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
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
        </div>
        {error && (
          <p className="app-form__error" role="alert">
            {error}
          </p>
        )}
        <button className="app-btn app-btn--block" type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthPage>
  );
}
