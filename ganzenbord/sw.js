// Service worker: bewaart de app lokaal zodat hij ook zonder internet start.
// Bij een nieuwe versie wordt CACHE opgehoogd; oude caches worden dan opgeruimd.
const CACHE = 'ganzenbord-v1';
const FILES = ["./", "index.html", "manifest.webmanifest", "apple-touch-icon.png", "icon-192.png", "icon-512.png"];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith('ganzenbord-') && k !== CACHE).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});
// Netwerk eerst (zodat updates direct binnenkomen), cache als terugval zonder internet.
// cache: 'no-cache' laat de browser altijd bij GitHub navragen of er een nieuwe versie is,
// in plaats van tot 10 minuten een oude kopie uit de browsercache te gebruiken.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
