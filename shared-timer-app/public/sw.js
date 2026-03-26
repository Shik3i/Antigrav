self.addEventListener('install', (e) => {
  console.log('[SW] Installiert');
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  console.log('[SW] Aktiviert');
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Wir lassen vorerst alle Netzwerk-Anfragen normal durchlaufen (Kein aggressives Caching)
});
