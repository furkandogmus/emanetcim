/*
 * Kendini kaldıran service worker (2026-08-23).
 * Eski PWA SW'si tarayıcılarda kurulu kaldı; bu dosya onun yerine yüklenir,
 * tüm önbellekleri siler, kaydı kaldırır ve açık sekmeleri yeniler.
 */
self.addEventListener("install", function () {
  self.skipWaiting();
});
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.registration.unregister(); })
      .then(function () { return self.clients.matchAll({ type: "window" }); })
      .then(function (clients) {
        clients.forEach(function (c) { c.navigate(c.url); });
      })
  );
});
