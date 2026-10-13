import { Link } from 'react-router-dom';
import { useTheme } from '../context/useTheme';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { LEGAL } from '../lib/legal';
import '../pages/legal.css';

/**
 * The frame for the Terms, the Privacy Policy and About: the brand, the page
 * as one readable column, and the way to the other pages. Public, so it sits
 * outside the signed-in shell, in the person's chosen theme like every other
 * page. `meta` is the line under the title; the legal pages take the default.
 */
export default function LegalPage({
  title,
  documentTitle = title,
  meta = `Last updated ${LEGAL.updated}`,
  summary,
  children,
}) {
  useDocumentTitle(documentTitle);
  const { theme } = useTheme();

  return (
    <div className="legal" data-theme={theme}>
      <header className="legal__top">
        <Link to="/" className="legal__brand">
          Mordi
        </Link>
      </header>
      <main className="legal__main">
        <article className="legal__article">
          <h1 className="legal__title">{title}</h1>
          {meta && <p className="legal__meta">{meta}</p>}
          {summary && (
            <section className="legal__summary" aria-label="In short">
              {summary}
            </section>
          )}
          {children}
        </article>
      </main>
      <footer className="legal__foot">
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/terms">Terms of Service</Link>
        <a href={`mailto:${LEGAL.contact}`}>{LEGAL.contact}</a>
      </footer>
    </div>
  );
}
