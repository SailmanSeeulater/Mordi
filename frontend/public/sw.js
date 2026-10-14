/*
 * Mordi's service worker. It does one thing: show the reminders the server
 * pushes, and open the dashboard when one is tapped. No caching, no offline
 * behaviour, nothing that could serve a stale app.
 */

self.addEventListener('push', (event) => {
  let data;
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Mordi', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Mordi', {
      body: data.body || '',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      // One reminder replaces the last rather than piling up.
      tag: data.tag || 'mordi',
      data: { url: data.url || '/dashboard' },
    }),
  );
});

/*
 * Where a tapped reminder may go: a page of this app, never anywhere else.
 * The url arrives in the push payload, so it is treated as untrusted and
 * resolved against this origin; anything that lands on another one, or does
 * not parse, falls back to the dashboard.
 */
function sameOriginUrl(url) {
  try {
    const resolved = new URL(url || '/dashboard', self.location.origin);
    return resolved.origin === self.location.origin ? resolved.href : '/dashboard';
  } catch {
    return '/dashboard';
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = sameOriginUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if ('focus' in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
