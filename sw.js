// Service worker: guarda os arquivos do jogo para funcionar offline.
const CACHE = 'portobrasa-v1';
const FILES = [
  './', './index.html', './styles.css', './manifest.webmanifest', './assets/icon.svg',
  './src/main.js', './src/game.js',
  './src/core/math.js', './src/core/input.js', './src/core/audio.js', './src/core/save.js', './src/core/camera.js',
  './src/world/constants.js', './src/world/city.js', './src/world/world-renderer.js', './src/world/flowfield.js',
  './src/entities/vehicle.js', './src/entities/vehicle-models.js', './src/entities/vehicle-sprites.js', './src/entities/human.js',
  './src/ai/traffic.js', './src/ai/pedestrians.js', './src/ai/police.js',
  './src/systems/missions.js', './src/systems/mission-data.js', './src/systems/daynight.js', './src/systems/particles.js',
  './src/ui/hud.js', './src/ui/menus.js', './src/ui/touch.js',
];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => {
    const copy = r.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request)));
});
