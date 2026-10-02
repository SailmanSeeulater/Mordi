/**
 * The token from a /reset-password#token link, or '' when there is none.
 *
 * It rides after the # for the same reason an invite code does: the fragment
 * never leaves the browser, so the token stays out of server logs and Referer
 * headers, and reaches the API only in a request body.
 */
export function readResetToken(hash) {
  const token = (hash ?? '').replace(/^#/, '').trim();
  return /^[A-Za-z0-9_-]{20,64}$/.test(token) ? token : '';
}
