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

  const actions =
    data.actions || [{ action: 'open', title: 'Open App' }];

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

function isSpecialProtocol(url) {
  try {
    const specialProtocols = ['upi://', 'tel:', 'sms:', 'mailto:', 'data:', 'intent://', 'web+'];
    return specialProtocols.some(protocol => url.toLowerCase().startsWith(protocol));
  } catch {
    return false;
  }
}

function toLaunchUrl(url) {
  try {
    const lower = url.toLowerCase();
    if (lower.startsWith('upi://')) {
      const withoutScheme = url.slice('upi://'.length);
      return `intent://${withoutScheme}#Intent;scheme=upi;end`;
    }
    return url;
  } catch {
    return url;
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification?.data?.url || '/';

  event.waitUntil(
    (async () => {
      const launchUrl = toLaunchUrl(url);
      let relayUrl = '';
      try {
        const target = new URL(launchUrl, self.location.origin);
        const isExternal = target.origin !== self.location.origin;
        if (isExternal && !isSpecialProtocol(launchUrl)) {
          relayUrl = `/external-launcher.html?u=${encodeURIComponent(target.href)}`;
          try { await self.clients.openWindow(relayUrl); } catch {}
        }
      } catch {}
      if (isSpecialProtocol(launchUrl)) {
        try {
          await self.clients.openWindow(launchUrl);
          return;
        } catch {
          return;
        }
      }

      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        try {
          const clientUrl = new URL(client.url);
          const targetUrl = relayUrl ? new URL(relayUrl, clientUrl.origin).href : new URL(launchUrl, clientUrl.origin).href;

          if (client.visibilityState === 'visible') {
            try {
              const urlObj = new URL(launchUrl, self.location.origin);
              const isInternalPath = !relayUrl && !isSpecialProtocol(launchUrl) && urlObj.origin === self.location.origin && !urlObj.pathname.includes('/storage/');
              if (isInternalPath) {
                await client.navigate(targetUrl);
                client.focus();
                return;
              }
            } catch {}
          }
        } catch {
          // If navigate fails for any reason, continue to fallback below
        }
      }

      await self.clients.openWindow(launchUrl);
    })()
  );
});
