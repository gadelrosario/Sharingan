const CACHE = 'fantasy-hq-jonin-3-7-2';
const ASSETS = [
  './',
  './index.html',
  './css/app.css?v=3.8.0',
  './js/app-version.js?v=1.0.0',
  './js/player-tier-contract.js?v=1.0.0',
  './js/roster-view-v1.js?v=1.0.0',
  './js/fantasy-hq-core.js?v=3.2.0',
  './js/command-center-v1.js?v=1.0.0',
  './js/jonin-insight-engine-v1.js?v=1.0.0',
  './js/sharingan-vision-v1.js?v=1.0.0',
  './js/jonin-ux-polish.js?v=1.0.0',
  './js/flight-control-v1.js?v=1.3.0',
  './js/adaptive-coaching-engine-v1.js?v=1.0.0',
  './js/premium-player-card-v1.js?v=1.0.0',
  './js/draft-psychology-engine-v1.js?v=1.0.0',
  './js/app.js?v=3.8.2',
  './assets/player-placeholders/generic.svg',
  './assets/player-placeholders/qb.svg',
  './assets/player-placeholders/rb.svg',
  './assets/player-placeholders/wr.svg',
  './assets/player-placeholders/te.svg',
  './assets/player-placeholders/k.svg',
  './assets/player-placeholders/dst.svg',
  './data/players.json',
  './manifest.webmanifest',
  './icons/icon.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
  );
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const protocol = new URL(event.request.url).protocol;
  if (protocol !== 'http:' && protocol !== 'https:') return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(hit => hit || caches.match('./index.html')))
  );
});
