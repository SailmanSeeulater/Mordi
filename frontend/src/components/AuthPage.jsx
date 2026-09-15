import { Link } from 'react-router-dom';
import './app.css';
import './auth.css';

export default function AuthPage({ title, footer, children }) {
  return (
    <div className="auth">
      <header className="auth__top">
        <Link to="/" className="auth__brand">
          Mordi
        </Link>
      </header>
      <main className="auth__main">
        <section className="app-panel auth__panel" aria-labelledby="auth-title">
          <div className="app-panel__head">
            <h1 id="auth-title" className="app-panel__title auth__title">
              {title}
            </h1>
          </div>
          {children}
          <p className="auth__foot">{footer}</p>
        </section>
      </main>
    </div>
  );
}
