// Wardrobe AI intentionally ships without offline caching for authenticated data.
// This cleanup worker removes caches left by the original local-first prototype.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
      self.registration.unregister(),
    ]).then(() => self.clients.claim()),
  );
});
