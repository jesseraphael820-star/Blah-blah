// Cache offline simples (rede primeiro, cache como reserva).
const CACHE = 'somx-v1';
const FILES = ['./', 'index.html', 'css/style.css', 'manifest.json', 'icon.svg', 'vendor/three.min.js',
  ...['main', 'data', 'save', 'audio', 'textures', 'models', 'maps', 'controls', 'fx', 'bots', 'game', 'hud', 'ui'].map(f => `js/${f}.js`)];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});
