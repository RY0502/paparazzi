// Minimal service worker for Web Push notifications
// Version: 2 - Force update for notification link handling
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  event.waitUntil(
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'SKIP_WAITING' });
      });
    })
  );
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
  const body = data.body || 'Tap to read today\'s top stories';
  const nestedUrl = data.data && data.data.url ? data.data.url : data.url || '/';
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
      data: { url: nestedUrl },
      requireInteraction: false,
      actions,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  const url = (event.notification && event.notification.data && event.notification.data.url) || '/';

  if (event.action === 'pay' || event.action === 'open' || !event.action) {
    event.notification.close();
    event.waitUntil(
      (async () => {
        try {
          const urlObj = new URL(url);
          const isExternal = urlObj.protocol === 'http:' || urlObj.protocol === 'https:';

          if (isExternal) {
            await self.clients.openWindow(url);
            return;
          }
        } catch {}

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
  }
});
