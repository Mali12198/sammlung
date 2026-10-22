// Service Worker: macht die Spielesammlung offline spielbar.
// Jede Version wird beim Installieren komplett und frisch aus dem Netz geladen und danach
// nur aus genau diesem Cache bedient – so werden nie alte und neue Dateien gemischt.
// Bei jeder Änderung an der App CACHE hochzählen, sonst kommt das Update nicht an.
const CACHE = 'spiele-v8';
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
  "js/games/farbreihen/engine.js",
  "js/games/farbreihen/rules.js",
  "js/games/farbreihen/view.js",
  "js/games/romme/engine.js",
  "js/games/romme/rules.js",
  "js/games/romme/view.js",
  "js/games/skat/engine.js",
  "js/games/skat/rules.js",
  "js/games/skat/view.js",
  "js/games/wuerfelpoker/engine.js",
  "js/games/wuerfelpoker/rules.js",
  "js/games/wuerfelpoker/view.js",
  "js/games/zahlensteine/engine.js",
  "js/games/zahlensteine/rules.js",
  "js/games/zahlensteine/view.js",
  "js/main.js",
  "js/players.js",
  "js/shell.js",
  "js/store.js",
  "js/ui.js",
  "js/util.js",
  "manifest.webmanifest",
];

self.addEventListener('install', e => {
  // cache: 'reload' umgeht den HTTP-Cache des Browsers, damit wirklich die neue Version ankommt
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // Die Seite gehört zur selben Version wie die Skripte; Updates kommen über einen neuen Service Worker.
    e.respondWith(caches.open(CACHE).then(c => c.match('./').then(hit => hit || fetch(req))));
    return;
  }
  e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok) c.put(req, res.clone());
    return res;
  }))));
});
