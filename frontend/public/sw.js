// Service Worker for Warehouse App Offline Support
const CACHE_NAME = 'warehouse-app-v1';
const STATIC_CACHE = 'warehouse-static-v1';

// Assets to cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== STATIC_CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls: network-first, fallback to offline queue notification
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request.clone())
        .catch(() => {
          // Notify clients that we're offline
          self.clients.matchAll().then(clients => {
            clients.forEach(client => client.postMessage({ type: 'OFFLINE_REQUEST', url: url.pathname }));
          });
          return new Response(JSON.stringify({ error: 'offline', message: 'No network connection' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
      )
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-actions') {
    event.waitUntil(syncOfflineActions());
  }
});

async function syncOfflineActions() {
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({ type: 'TRIGGER_SYNC' }));
}
