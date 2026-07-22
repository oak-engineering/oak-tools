/* Service Worker fuer den OAK-Begehungsbogen.
   Grund: Die App ist eine einzige HTML-Datei, wurde aber bei jedem Start und frueher bei
   jedem Ebenenwechsel neu aus dem Netz geladen. In einer Werkhalle ohne Empfang landete
   man damit auf der Offline-Fehlerseite - die Begehung am 22.07.2026 ist daran gescheitert.

   Strategie: stale-while-revalidate. Der Bogen kommt sofort aus dem Cache (auch offline),
   im Hintergrund wird die neue Fassung geholt und beim naechsten Start ausgeliefert.
   Nutzdaten liegen ausschliesslich in IndexedDB und werden hier NICHT angefasst. */
const CACHE = "oak-begehung-v1";
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

  /* Navigation: immer die gecachte App ausliefern, damit ein Start ohne Netz funktioniert. */
  if (req.mode === "navigate") {
    e.respondWith(
      caches.match("./index.html").then(treffer => {
        const netz = fetch(req).then(res => {
          if (res && res.ok) caches.open(CACHE).then(c => c.put("./index.html", res.clone()));
          return res;
        }).catch(() => treffer);
        return treffer || netz;
      })
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
