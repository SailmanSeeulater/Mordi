import { Link } from 'react-router-dom';
import useDocumentTitle from '../hooks/useDocumentTitle';
import './placeholder.css';

/**
 * Shared "work in progress" page.
 * Used for /about, /privacy and /terms until real content exists.
 * Also handy as a known-good route target when smoke-testing routing.
 */
export default function Placeholder({ title }) {
  useDocumentTitle(title);

  return (
    <div className="wip">
      <div className="wip__inner">
        <span className="wip__kicker">Work in progress</span>
        <h1 className="wip__title">{title}</h1>
        <p className="wip__body">
          This page doesn&rsquo;t have its content written yet. The route works
          &mdash; there&rsquo;s just nothing here to read.
        </p>
        <Link to="/" className="btn btn-ghost wip__back">
          Back to home
        </Link>
      </div>
    </div>
  );
}