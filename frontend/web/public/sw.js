// ShoppersDeals Web Push Service Worker
// Handles background push events and notification interactions for price drop alerts

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('[SW] Push received but no payload data');
    return;
  }

  let payload = {};
  try {
    payload = event.data.json();
  } catch (err) {
    payload = {
      title: 'ShoppersDeals Price Drop! 🎉',
      body: event.data.text() || 'A tracked product dropped in price!',
    };
  }

  const title = payload.title || '⚡ Price Drop Alert! | ShoppersDeals';
  const targetUrl = payload.url || (payload.data && payload.data.url) || '/';

  const options = {
    body: payload.body || 'A product you are tracking just dropped in price. Tap to grab the deal!',
    icon: payload.icon || '/favicon-96x96.png',
    badge: payload.badge || '/favicon-96x96.png',
    image: payload.imageUrl || payload.image || undefined,
    tag: payload.productId ? `deal-${payload.productId}` : 'shoppersdeals-alert',
    renotify: true,
    requireInteraction: false,
    vibrate: [150, 50, 150],
    data: {
      url: targetUrl,
      productId: payload.productId,
      timestamp: Date.now(),
    },
    actions: [
      { action: 'open_deal', title: '🔥 View Deal' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open on this origin, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
