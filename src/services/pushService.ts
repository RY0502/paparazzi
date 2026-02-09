const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function isNotificationsEnabled(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

export async function enableNotifications(): Promise<{ success: boolean; message?: string }> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { success: false, message: 'Browser does not support notifications' };
    }
    const isSecure =
      location.protocol === 'https:' ||
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1';
    if (!isSecure) {
      return { success: false, message: 'Use HTTPS (or localhost) to enable push' };
    }
    const ua = navigator.userAgent || '';
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isStandalone =
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      ((navigator as any).standalone === true);
    if (isIOS && !isStandalone) {
      return { success: false, message: 'On iPhone, install to Home Screen to enable push' };
    }
    if (!supabaseUrl || !supabaseAnonKey) {
      return { success: false, message: 'Supabase is not configured' };
    }
    if (!vapidPublicKey) {
      return { success: false, message: 'VAPID public key missing' };
    }

    let reg: ServiceWorkerRegistration | undefined;
    try {
      reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    } catch (e) {
      return { success: false, message: 'Service worker registration failed' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, message: 'Permission denied' };
    }

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      let appServerKey: Uint8Array;
      try {
        appServerKey = urlBase64ToUint8Array(vapidPublicKey);
      } catch {
        return { success: false, message: 'Invalid VAPID public key' };
      }
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Subscription failed';
        return { success: false, message: msg };
      }
    }

    const subscription = sub.toJSON();
    const url = `${supabaseUrl}/functions/v1/push-subscribe`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription,
          userAgent: navigator.userAgent,
        }),
      });
    } catch {
      return { success: false, message: 'Failed to reach push-subscribe endpoint' };
    }
    if (!res.ok) {
      return { success: false, message: `Failed to save subscription: ${res.status}` };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, message };
  }
}
