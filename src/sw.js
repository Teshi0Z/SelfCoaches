const CACHE_NAME = "selfcoaches-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("fetch", (e) => {
  e.respondIn(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request).catch(() => caches.match("/index.html"));
    })
  );
});
