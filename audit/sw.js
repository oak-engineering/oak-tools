/* Service Worker fuer den OAK-Auditbogen.
   Grund: Ein internes Audit laeuft durch Produktionshallen, Lager und Aussenanlagen - also
   genau dort, wo kein Empfang ist. Ohne Service Worker landet jeder Start ohne Netz auf der
   Browser-Fehlerseite, und ein Audittag ohne Werkzeug ist verloren. Der Begehungsbogen hat
   das seit der gescheiterten Begehung am 22.07.2026; der Auditbogen bekommt denselben Schutz.

   Strategie: NETWORK-FIRST fuer die App. Mit Netz kommt immer die aktuelle Fassung (Updates
   sind sofort da), nur im Funkloch faellt die App auf den Cache zurueck. Cache-first waere
   falsch: ein wiederkehrender Nutzer saehe nie ein Update, obwohl es laengst deployt ist.
   Nutzdaten (Audits, Feststellungen, Normpaket) liegen in IndexedDB und bleiben unangetastet.

   WICHTIG: Bei JEDER Aenderung am Auditbogen die Cache-Version hochzaehlen (v1 -> v2 ...),
   damit activate den alten Cache purged. */
const CACHE = "oak-audit-v1";
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
  if (req.method !== "GET") return;                 // Uploads ins Portal nie abfangen

  /* Der Upload geht an Supabase. Selbst ein GET dorthin gehoert nie in den App-Cache -
     signierte URLs laufen ab, ein gecachtes Ergebnis waere schlimmer als keins. */
  if (req.url.indexOf("supabase.co") >= 0) return;

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
    caches.match(req).then(treffer =>
      treffer || fetch(req).then(res => {
        if (res && res.ok && (res.type === "basic" || res.type === "cors")) {
          const kopie = res.clone();
          caches.open(CACHE).then(c => c.put(req, kopie));
        }
        return res;
      }).catch(() => treffer)
    )
  );
});
