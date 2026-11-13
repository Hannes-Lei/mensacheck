// ============================================================================
// Schmausi – Service Worker
// 1. Push-Nachrichten anzeigen
// 2. Die App öffnet auch, wenn das Netz gerade weg ist (Funkloch, WLAN-Wechsel):
//    • Die Startseite kommt IMMER zuerst frisch aus dem Netz – nach einem Update
//      ist also sofort die neue Version da. Nur wenn das Netz nicht antwortet,
//      wird die zuletzt geladene Fassung gezeigt.
//    • Die Programmdateien (/assets/…) haben bei jeder Version einen neuen
//      Namen und dürfen deshalb gespeichert bleiben.
//    • Speisepläne (/api/…) und Supabase werden hier NICHT gespeichert.
// ============================================================================
const CACHE = "schmausi-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name);
  await self.clients.claim();
})()));

// Startseite: erst Netz (höchstens 4 Sekunden warten), sonst die gespeicherte
async function startPage(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("zu langsam")), 4000)),
    ]);
    if (fresh.ok) {
      const copy = fresh.clone();
      cache.put("/", fresh.clone()).then(() => tidyUp(cache, copy)).catch(() => {});
    }
    return fresh;
  } catch (err) {
    const saved = await cache.match("/");
    if (saved) return saved;
    throw err;
  }
}
// Programmdateien alter Versionen wieder löschen
async function tidyUp(cache, page) {
  const html = await page.text();
  for (const req of await cache.keys()) {
    const path = new URL(req.url).pathname;
    if (path.startsWith("/assets/") && !html.includes(path)) await cache.delete(req);
  }
}
// Programmdateien: gespeicherte nehmen, sonst holen und speichern
async function assetFile(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(request);
  if (saved) return saved;
  const fresh = await fetch(request);
  if (fresh.ok) cache.put(request, fresh.clone()).catch(() => {});
  return fresh;
}
// Symbole usw.: aus dem Netz, bei Funkloch die gespeicherten
async function otherFile(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone()).catch(() => {});
    return fresh;
  } catch (err) {
    const saved = await cache.match(request);
    if (saved) return saved;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;                       // Supabase usw.: nicht anfassen
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;
  if (request.mode === "navigate") event.respondWith(startPage(request));
  else if (url.pathname.startsWith("/assets/")) event.respondWith(assetFile(request));
  else event.respondWith(otherFile(request));
});

// Nachricht empfangen und anzeigen
self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data ? event.data.text() : "" }; }
  event.waitUntil(
    self.registration.showNotification(d.title || "Schmausi", {
      body: d.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: d.tag,
      data: { url: d.url || "/" },
    })
  );
});

// Antippen: App öffnen (oder nach vorne holen) und passende Stelle zeigen
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if ("focus" in w) {
        await w.focus();
        if ("navigate" in w) { try { await w.navigate(url); } catch { /* egal */ } }
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});
