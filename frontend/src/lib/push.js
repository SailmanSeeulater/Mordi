import client from '../api/client';

/**
 * Web Push in the browser: whether it can work here, and subscribing this
 * browser to the server's reminders or taking it off again.
 *
 * Needs a secure context (https, or http://localhost), a service worker and
 * the Push API. Safari only allows it for sites added to the home screen on
 * iPhone; everywhere else it works in the ordinary browser.
 */
export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** A base64url VAPID public key as the bytes subscribe() wants. */
function keyBytes(base64url) {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return reg ? reg.pushManager.getSubscription() : null;
}

/**
 * Asks for permission, registers the service worker, subscribes, and tells
 * the server where to send and in which time zone this person lives.
 * Throws 'denied' when the person or the browser says no.
 */
export async function subscribe(publicKey) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('denied');
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  }
  const json = sub.toJSON();
  await client.post('/api/push/subscribe', {
    endpoint: json.endpoint,
    keys: json.keys,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  return sub;
}

export async function unsubscribe() {
  const sub = await currentSubscription();
  if (!sub) return;
  await client.post('/api/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}

export function localTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Why turning on failed, as specifically as the error allows: the server's
 * own reason when it refused, the browser's when the push service did, and a
 * plain line for everything else. One sentence for every case hid the cause.
 *
 * The person reads what happened and what to do; the status code or the
 * browser's error name goes to the console, where it helps whoever is fixing
 * it and nobody else.
 */
export function turnOnFailure(err) {
  if (err?.message === 'denied') {
    return 'Notifications are blocked for this site. Allow them in your browser’s site settings, then try again.';
  }
  const server = err?.response?.data?.error;
  if (server) return server;
  if (err?.response?.status) {
    console.warn(`Turning reminders on failed: the server answered ${err.response.status}.`);
    return 'Couldn’t turn reminders on. Try again in a moment.';
  }
  if (err?.name === 'AbortError' || err?.name === 'NotAllowedError' || err?.name === 'InvalidAccessError') {
    console.warn(`Turning reminders on failed: the push service refused (${err.name}).`);
    return 'This browser wouldn’t allow reminders. On an iPhone, add Mordi to your home screen first; otherwise reload the page and try again.';
  }
  if (err?.name === 'SecurityError' || /service ?worker/i.test(err?.message ?? '')) {
    console.warn(`Turning reminders on failed: the service worker could not start (${err?.message ?? err?.name}).`);
    return 'Reminders couldn’t start in this browser. Reload the page and try again.';
  }
  console.warn(`Turning reminders on failed: ${err?.message || 'unknown error'}.`);
  return 'Couldn’t turn reminders on. Check your connection and try again.';
}
