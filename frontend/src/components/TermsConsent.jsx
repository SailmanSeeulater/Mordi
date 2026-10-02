import { Link } from 'react-router-dom';

/**
 * The line beside "Create account" that makes signing up agreeing. Opens the
 * pages in a new tab, so reading them does not lose a half-filled form. The
 * server records which version was agreed to.
 */
export default function TermsConsent() {
  return (
    <p className="app-form__consent">
      By creating an account, you agree to Mordi&rsquo;s{' '}
      <Link to="/terms" target="_blank" rel="noopener">
        Terms of Service
      </Link>{' '}
      and{' '}
      <Link to="/privacy" target="_blank" rel="noopener">
        Privacy Policy
      </Link>
      .
    </p>
  );
}
