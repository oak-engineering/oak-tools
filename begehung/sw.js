/* Service Worker fuer den OAK-Begehungsbogen.
   Grund: Die App ist eine einzige HTML-Datei, wurde aber bei jedem Start und frueher bei
   jedem Ebenenwechsel neu aus dem Netz geladen. In einer Werkhalle ohne Empfang landete
   man damit auf der Offline-Fehlerseite - die Begehung am 22.07.2026 ist daran gescheitert.

   Strategie: NETWORK-FIRST fuer die App. Mit Netz kommt immer die aktuelle Fassung (Updates
   sind sofort da), nur im Funkloch faellt die App auf den Cache zurueck - so bleibt sie
   offline lauffaehig. Die erste Version war cache-first: dabei sah ein wiederkehrender Nutzer
   nie ein Update, obwohl es laengst deployt war. Nutzdaten liegen in IndexedDB, unangetastet.

   WICHTIG: Bei JEDER Aenderung am Tool die Cache-Version hochzaehlen (v2 -> v3 ...), damit
   activate den alten Cache purged. */
const CACHE = "oak-begehung-v2";
const SHELL = ["./", "./index.html", "./manifest.webmanifest"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;                 // Uploads nie abfangen

  /* Navigation: NETWORK-FIRST. Erst das Netz - so ist ein Update sofort da. Den Erfolg in den
     Cache legen, damit die App im Funkloch trotzdem startet. Nur bei Netzfehler den Cache. */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const kopie = res.clone();
            caches.open(CACHE).then(c => c.put("./index.html", kopie));
          }
          return res;
        })
        .catch(() => caches.match("./index.html").then(t => t || caches.match("./")))
    );
    return;
  }

  /* Alles andere (Schriften): aus dem Cache, sonst Netz - und Erfolge mitnehmen.
     Faellt die Schrift aus, greifen die Systemfallbacks im CSS. */
  e.respondWith(
    caches.match(req).then(treffer => treffer || fetch(req).then(res => {
      if (res && res.ok && (res.type === "basic" || res.type === "cors")) {
        const kopie = res.clone();
        caches.open(CACHE).then(c => c.put(req, kopie));
      }
      return res;
    }).catch(() => treffer))
  );
});
