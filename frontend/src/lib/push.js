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
