const CACHE_NAME = 'lolesports-images-v1';
const LOLESPORTS_DOMAIN = 'static.lolesports.com';
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

self.addEventListener('install', (e) => {
  console.log('[SW] Installiert');
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  console.log('[SW] Aktiviert');
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strikte Beschränkung auf externe lolesports Domain
  // Kein Abfangen von /api/ oder WebSockets!
  if (url.hostname === LOLESPORTS_DOMAIN) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        const now = Date.now();
        
        if (cachedResponse) {
          // Manuelle Timestamp-Logik für 7 Tage Expiration
          const dateHeader = cachedResponse.headers.get('date');
          const cacheDate = dateHeader ? new Date(dateHeader).getTime() : now;
          
          if (now - cacheDate < SEVEN_DAYS) {
            return cachedResponse;
          }
          // Wenn abgelaufen -> löschen
          cache.delete(event.request);
        }

        // Cache Miss oder Abgelaufen -> Netzwerk holen und cachen
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse.ok || networkResponse.type === 'opaque') {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });
      })
    );
  }
});

