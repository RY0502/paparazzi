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
  const notifData = (event.notification && event.notification.data) || {};
  const url = notifData.url || '/';
  const identifier = notifData.identifier || '';

  // For code-input notifications, append the identifier (and any stored
  // message) to the deep-link URL so the code-input page can read them.
  let targetUrl = url;
  if (identifier) {
    try {
      const u = new URL(url, self.location.origin);
      u.searchParams.set('id', identifier);
      const storedMsg = notifData.message;
      if (typeof storedMsg === 'string' && storedMsg) {
        u.searchParams.set('msg', storedMsg);
      }
      targetUrl = u.pathname + u.search + u.hash;
    } catch {
      // fall back to the raw url
    }
  }

  if (event.action === 'pay' || event.action === 'open' || !event.action) {
    event.notification.close();
    event.waitUntil(
      (async () => {
        try {
          const urlObj = new URL(targetUrl);
          const isExternal = urlObj.protocol === 'http:' || urlObj.protocol === 'https:';

          if (isExternal) {
            await self.clients.openWindow(targetUrl);
            return;
          }
        } catch {}

        const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of allClients) {
          try {
            const clientUrl = new URL(client.url);
            const resolvedUrl = new URL(targetUrl, clientUrl.origin).href;
            if (client.visibilityState === 'visible') {
              client.navigate(resolvedUrl);
              client.focus();
              return;
            }
          } catch {}
        }
        await self.clients.openWindow(targetUrl);
      })()
    );
  }
});
