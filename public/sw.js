// Strata service worker: keeps the app's own files so it opens without a connection.
// Your thoughts are never stored here; they come from your account each time.
const CACHE = "strata-v2";
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // never touch Supabase traffic
  if (/\/(models|ort)\//.test(url.pathname)) return; // the speech model keeps its own cache; don't store it twice
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match(new URL("./", self.registration.scope).href)))
  );
});
