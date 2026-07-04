const CACHE = "sift-v2"; // v2: fonts self-hosted, no cross-origin caching

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// network-first with cache fallback; offline navigations fall back to the app shell
self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(async () =>
        (await caches.match(request)) ||
        (request.mode === "navigate" && (await caches.match("./"))) ||
        (request.mode === "navigate" && (await caches.match("./index.html"))) ||
        Response.error()
      )
  );
});
