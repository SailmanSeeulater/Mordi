import { Link } from 'react-router-dom';
import './legal-notice.css';

/**
 * The consent line under a sign-up form. Creating an account means agreeing to
 * the terms and the privacy page, so both sign-up surfaces say it in one place:
 * the standalone Register page and the sign-up dialog on the landing page.
 */
export default function LegalNotice() {
  return (
    <p className="legal-notice">
      By creating an account, you agree to Mordi&rsquo;s{' '}
      <Link to="/terms">Terms of use</Link> and{' '}
      <Link to="/privacy">Privacy page</Link>.
    </p>
  );
}
