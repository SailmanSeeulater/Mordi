/**
 * Where to go after signing in: back to the page that sent the person to
 * sign in (an invite link, say), if it was one of this app's own pages.
 * Anything else, including another origin, goes to the dashboard.
 */
export function returnPath(state, fallback = '/dashboard') {
  const from = state?.from;
  const path = from?.pathname;
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return fallback;
  if (path === '/login' || path === '/register' || path === '/') return fallback;
  return path + (from.search ?? '') + (from.hash ?? '');
}
