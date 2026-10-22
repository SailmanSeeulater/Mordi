import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { LEGAL } from '../lib/legal';
import '../pages/legal.css';

/**
 * The reading layout for Privacy and Terms: one measure-wide column, the
 * short version first, a list of sections to jump to, then the sections.
 * Public pages, so they carry the theme themselves rather than the app shell.
 */
export default function LegalPage({ title, summary, sections, other }) {
  useDocumentTitle(title);
  const { theme } = useTheme();
  const { user } = useAuth();
  const { hash } = useLocation();

  // A link straight to a section (/privacy#keep) arrives before this page's
  // code has loaded, so the browser's own jump finds nothing. Jump once the
  // sections exist.
  useEffect(() => {
    if (!hash) return;
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  }, [hash]);

  return (
    <div className="legal" data-theme={theme}>
      <header className="legal__bar">
        <Link to={user ? '/dashboard' : '/'} className="legal__brand">
          Mordi
        </Link>
        <nav className="legal__switch" aria-label="Policies">
          <Link to={other.to}>{other.label}</Link>
        </nav>
      </header>

      <main className="legal__main">
        <article className="legal__doc" aria-labelledby="legal-title">
          <h1 className="legal__title" id="legal-title">
            {title}
          </h1>
          <p className="legal__updated">
            Last updated <time dateTime={LEGAL.updated}>{LEGAL.updatedLabel}</time>
          </p>

          <section className="legal__summary" aria-labelledby="legal-summary">
            <h2 className="legal__summary-title" id="legal-summary">
              The short version
            </h2>
            <ul>
              {summary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          <nav className="legal__toc" aria-label="Sections">
            <ol>
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.title}</a>
                </li>
              ))}
            </ol>
          </nav>

          {sections.map((s) => (
            <section key={s.id} id={s.id} className="legal__section" aria-labelledby={`${s.id}-h`}>
              <h2 id={`${s.id}-h`}>{s.title}</h2>
              {s.body}
            </section>
          ))}

          <p className="legal__contact">
            Questions about this page: <a href={`mailto:${LEGAL.contact}`}>{LEGAL.contact}</a>
          </p>
        </article>
      </main>
    </div>
  );
}
