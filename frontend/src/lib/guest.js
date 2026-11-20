/*
 * "Try it": a guest account, made without an email or password and deleted
 * a week later unless the person saves it. The server holds every limit
 * (what a guest may not do, how much it may hold, how many may be opened);
 * this is the app's side of it: starting one, telling the person when it
 * goes, and offering to save it wherever a limit is met.
 */
import client, { SAVE_ACCOUNT } from '../api/client';

export { SAVE_ACCOUNT };

export function isGuest(user) {
  return Boolean(user?.guestUntil);
}

/**
 * The day the guest account goes, as "Thursday, November 26". The server's
 * timestamps carry no zone, so only the date is shown, as everywhere else.
 */
export function guestEndsOn(user, locale) {
  const iso = String(user?.guestUntil ?? '').slice(0, 10);
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/** Opens the save dialog from anywhere in the app. */
export function askToSave(reason = '') {
  window.dispatchEvent(new CustomEvent(SAVE_ACCOUNT, { detail: { reason } }));
}

/**
 * The server's refusal of something a guest may not do ("blocked") or of
 * anything new past the cap ("full"): its message, or null for any other error.
 */
export function guestRefusal(error) {
  const data = error?.response?.data;
  return error?.response?.status === 403 && data?.guest ? data.error || 'Save your account to use this.' : null;
}

function browserZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/** Opens a guest account with the sample fortnight. Resolves to the session. */
export async function startGuest() {
  const res = await client.post('/api/auth/guest', { timeZone: browserZone(), sample: true });
  return res.data;
}

/** The words for a "Try it" that failed, from the server where it said. */
export function startGuestError(error) {
  const status = error?.response?.status;
  if ((status === 429 || status === 503) && error.response.data?.error) return error.response.data.error;
  return 'Couldn’t open the demo just now. Check your connection and try again in a moment.';
}

/** What a session reply is kept as in this browser. */
export function sessionUser(data) {
  return { email: data.email, name: data.name, guestUntil: data.guestUntil ?? null };
}
