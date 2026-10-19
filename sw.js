// Network first so updates show up right away; fall back to cache offline.
importScripts('games.js');

const CACHE = 'mind-games-v5';
const SHELL = [
  './', 'index.html', 'styles.css', 'games.js', 'shell.js', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'manifest.webmanifest',
  'shared/combine.js', 'shared/combine.css', 'shared/latin.js', 'shared/latin.css', 'shared/cards.js', 'shared/cards.css',
  ...GAMES.flatMap(g => [`games/${g.id}/`, `games/${g.id}/game.js`]),
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
