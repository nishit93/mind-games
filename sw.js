// Network first so updates show up right away; fall back to cache offline.
importScripts('games.js');

const CACHE = 'quiet-board-v33';
const SHELL = [
  './', 'index.html', 'styles.css', 'games.js', 'i18n.js', 'lang/hi.js', 'lang/hi.games1.js', 'lang/hi.games2.js', 'lang/hi.games3.js', 'lang/hi.games4.js', 'lang/hi.play.js', 'similarity.js', 'shell.js', 'progress.js', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'manifest.webmanifest',
  'shared/combine.js', 'shared/combine.css', 'shared/latin.js', 'shared/latin.css', 'shared/cards.js', 'shared/cards.css', 'shared/tutorial.js', 'shared/stats.js',
  ...GAMES.flatMap(g => [`games/${g.id}/`, `games/${g.id}/game.js`]),
];

self.addEventListener('install', e => {
  // Add the files one by one and ignore failures, so a single missing file can never block an update.
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(url => c.add(new Request(url, { cache: 'reload' }))))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

// Ask the server whether a file changed instead of trusting the browser's own short-term copy,
// so a visit right after an update never mixes new and old files.
const fresh = request => fetch(request, { cache: 'no-cache' }).catch(() => fetch(request));

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Never touch API calls: player data must not be kept in the offline cache.
  if (new URL(e.request.url).pathname.startsWith('/v1/')) return;
  e.respondWith(
    fresh(e.request)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(hit => hit || Response.error()))
  );
});
