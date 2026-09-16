import { Link } from 'react-router-dom';
import { useTheme } from '../context/useTheme';
import useDocumentTitle from '../hooks/useDocumentTitle';
import './placeholder.css';

/**
 * Shared "work in progress" page.
 * Used for /about, /privacy and /terms until real content exists.
 * Also handy as a known-good route target when smoke-testing routing.
 */
export default function Placeholder({
  title,
  backTo = '/',
  backLabel = 'Back to home',
  // Inside the app shell the top bar already carries the page's h1.
  headingTag: Heading = 'h1',
}) {
  useDocumentTitle(title);
  const { theme } = useTheme();

  return (
    <div className="wip" data-theme={theme}>
      <div className="wip__inner">
        <span className="wip__kicker">Work in progress</span>
        <Heading className="wip__title">{title}</Heading>
        <p className="wip__body">
          This page doesn&rsquo;t have its content written yet. The route works
          &mdash; there&rsquo;s just nothing here to read.
        </p>
        <Link to={backTo} className="btn btn-ghost wip__back">
          {backLabel}
        </Link>
      </div>
    </div>
  );
}