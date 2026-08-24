const CACHE = 'fantasy-hq-jonin-4-4-1d1-season-home-roster-2026-08-24';
const ASSETS = [
  './',
  './index.html',
  './css/app.css?v=4.4.1d1',
  './js/app-version.js?v=1.0.18',
  './js/player-tier-contract.js?v=1.0.0',
  './js/specialist-rankings-v1.js?v=1.0.0',
  './js/draft-math-v1.js?v=1.1.0',
  './js/injury-intelligence-v1.js?v=1.2.0',
  './js/espn-injury-adapter-v1.js?v=1.0.0',
  './js/sleeper-injury-adapter-v1.js?v=1.2.0',
  './js/data-health-v1.js?v=1.0.0',
  './js/roster-view-v1.js?v=1.0.0',
  './js/roster-completion-constraint-v1.js?v=1.1.0',
  './js/draft-strategy-engine-v1.js?v=1.3.0',
  './js/championship-equity-production-v1.js?v=1.0.0',
  './js/recommendation-archetypes-v1.js?v=1.1.0',
  './js/fantasy-hq-core.js?v=3.2.0',
  './js/draft-session-v1.js?v=1.3.0',
  './js/draft-workflow-v1.js?v=1.3.0',
  './js/league-profiles-v1.js?v=1.1.0',
  './js/yahoo-season-v1.js?v=1.0.0',
  './js/yahoo-sync-v1.js?v=1.0.0',
  './js/season-command-center-v1.js?v=1.1.2',
  './js/jonin-decision-intelligence-v1.js?v=1.0.3',
  './js/draft-grading-engine-v1.js?v=1.0.0',
  './js/command-center-v1.js?v=1.1.0',
  './js/jonin-insight-engine-v1.js?v=1.0.0',
  './js/sharingan-vision-v1.js?v=1.1.0',
  './js/jonin-ux-polish.js?v=1.0.0',
  './js/flight-control-v1.js?v=1.3.0',
  './js/adaptive-coaching-engine-v1.js?v=1.0.0',
  './js/player-photo-v1.js?v=1.0.0',
  './js/premium-player-card-v1.js?v=1.1.0',
  './js/draft-psychology-engine-v1.js?v=1.0.0',
  './js/app.js?v=4.4.1d1',
  './assets/player-placeholders/generic.svg',
  './assets/player-placeholders/qb.svg',
  './assets/player-placeholders/rb.svg',
  './assets/player-placeholders/wr.svg',
  './assets/player-placeholders/te.svg',
  './assets/player-placeholders/k.svg',
  './assets/player-placeholders/dst.svg',
  './data/players.json',
  './data/rankings/ACTIVE_SNAPSHOT.json',
  './data/rankings/fantasyland_2026-08-08.normalized.json',
  './data/rankings/fantasyland_draftday_2026-08-23.normalized.json',
  './data/rankings/flock_draftday_2026-08-23.normalized.json',
  './data/rankings/draftday_rankings_manifest_2026-08-23.json',
  './data/specialist_rankings_2026-08-09.json',
  './data/injuries_2026.json',
  './data/championship_equity_2026.json',
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
