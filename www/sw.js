// Service worker: offline app shell + an internal web server that serves the
// virtual PCs' files (vfs/<pcId>/<path>) straight from IndexedDB, so imported
// HTML5/WebAssembly games with many relative assets run like on a real server.

const VERSION = "vpc-1.0.0";
const CORE = [
  "./", "index.html", "manifest.webmanifest", "assets/icon.svg",
  "css/base.css", "css/launcher.css", "css/desktop.css", "css/apps.css", "css/input.css",
  "js/main.js", "js/core/util.js", "js/core/db.js", "js/core/bus.js", "js/core/vfs.js", "js/core/pcs.js", "js/core/metrics.js",
  "js/ui/launcher.js", "js/ui/boot.js", "js/ui/desktop.js", "js/ui/wm.js", "js/ui/input.js", "js/ui/icons.js", "js/ui/wallpapers.js", "js/apps/registry.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

function openDB() {
  return new Promise((res, rej) => { const r = indexedDB.open("virtual-pc"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function vfsGet(key) {
  const db = await openDB();
  return new Promise((res, rej) => { const t = db.transaction("files").objectStore("files").get(key); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); });
}

async function serveVfs(url) {
  const scope = new URL(self.registration.scope);
  const rest = url.pathname.slice(scope.pathname.length + "vfs/".length);
  const [pc, ...parts] = rest.split("/");
  let path = "/" + parts.map(decodeURIComponent).join("/");
  const key = (p) => decodeURIComponent(pc) + ":" + p.replace(/\/+$/, "") ;
  let rec = await vfsGet(key(path));
  if (rec?.type === "dir") rec = (await vfsGet(key(path.replace(/\/$/, "") + "/index.html"))) || null;
  if (!rec || !rec.data) return new Response("Arquivo não encontrado no Virtual PC: " + path, { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const headers = { "content-type": rec.mime || "application/octet-stream", "cache-control": "no-store", "cross-origin-resource-policy": "same-origin" };
  if (/\.wasm$/i.test(path)) headers["content-type"] = "application/wasm";
  if (/\.m?js$/i.test(path)) headers["content-type"] = "text/javascript";
  return new Response(rec.data, { status: 200, headers });
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  const scope = new URL(self.registration.scope);
  if (url.pathname.startsWith(scope.pathname + "vfs/")) { e.respondWith(serveVfs(url)); return; }
  // stale-while-revalidate for the app itself (works offline after first use)
  e.respondWith(caches.open(VERSION).then(async (c) => {
    const hit = await c.match(e.request, { ignoreSearch: url.pathname.endsWith("/") || url.pathname.endsWith("index.html") });
    const net = fetch(e.request).then((r) => { if (r.ok && r.type === "basic") c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
