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

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/dashboard';
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
