// Service Worker: macht die Spielesammlung offline spielbar.
// Seiten kommen bevorzugt aus dem Netz (damit Updates ankommen), alles andere aus dem Cache
// und wird im Hintergrund aufgefrischt.
const CACHE = 'spiele-v1';
const CORE = [
  './',
  "assets/fonts/jost-400.woff2",
  "assets/fonts/jost-600.woff2",
  "assets/fonts/young-serif.woff2",
  "assets/icons/icon-180.png",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "css/app.css",
  "css/games.css",
  "index.html",
  "js/cards/render.js",
  "js/cards/table.js",
  "js/games/backgammon/engine.js",
  "js/games/backgammon/rules.js",
  "js/games/backgammon/view.js",
  "js/games/canasta/engine.js",
  "js/games/canasta/rules.js",
  "js/games/canasta/view.js",
  "js/games/chess/engine.js",
  "js/games/chess/rules.js",
  "js/games/chess/view.js",
  "js/games/doppelkopf/engine.js",
  "js/games/doppelkopf/rules.js",
  "js/games/doppelkopf/view.js",
  "js/games/skat/engine.js",
  "js/games/skat/rules.js",
  "js/games/skat/view.js",
  "js/main.js",
  "js/shell.js",
  "js/store.js",
  "js/ui.js",
  "js/util.js",
  "manifest.webmanifest",
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./', copy)); return res; })
      .catch(() => caches.match('./')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
