// Minimal service worker for Web Push notifications
// Install/activate quickly
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function getPayload(event) {
  try {
    const data = event.data ? event.data.json() : {};
    return typeof data === 'object' && data ? data : {};
  } catch {
    return {};
  }
}

self.addEventListener('push', (event) => {
  const data = getPayload(event);
  const title = data.title || 'Paparazzi Daily';
  const body = data.body || 'Tap to read today’s top stories';
  const url = data.url || '/';
  const icon =
    data.icon ||
    'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4f0.svg';
  const image = data.image || undefined;
  const badge = data.badge || undefined;
  const tag = data.tag || 'paparazzi-daily';
  const actions = data.actions || [
    { action: 'open', title: 'Open App' },
  ];

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      image,
      badge,
      tag,
      vibrate: [80, 40, 120],
      data: { url },
      requireInteraction: false,
      actions,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification && event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        try {
          const clientUrl = new URL(client.url);
          const targetUrl = new URL(url, clientUrl.origin).href;
          if (client.visibilityState === 'visible') {
            client.navigate(targetUrl);
            client.focus();
            return;
          }
        } catch {}
      }
      await self.clients.openWindow(url);
    })()
  );
});

