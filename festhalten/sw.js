/* Service Worker für OAK Festhalten: Die App startet auch im Funkloch. Network-first, Uploads nie abfangen.
   Bei jeder Änderung am Tool die Cache-Version hochzählen. */
const CACHE = "oak-festhalten-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(res => {
      if (res && res.ok) { const k = res.clone(); caches.open(CACHE).then(c => c.put("./index.html", k)); }
      return res;
    }).catch(() => caches.match("./index.html").then(t => t || caches.match("./"))));
    return;
  }
  e.respondWith(caches.match(req).then(t => t || fetch(req).then(res => {
    if (res && res.ok && (res.type === "basic" || res.type === "cors")) { const k = res.clone(); caches.open(CACHE).then(c => c.put(req, k)); }
    return res;
  })));
});
