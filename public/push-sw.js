/*
 * Uygulama service worker'i: PUSH + CEVRIMDISI SAYFA.
 *
 * 2026-08-23'te eski worker kaldirildi cunku yetkili API yanitlarini
 * onbellege aliyordu -- bir kullanicinin verisi baska bir oturumda geri
 * servis edilebiliyordu. Bu worker o sinifi YAPISAL olarak disarida birakir:
 *
 *   - Onbellege yalnizca kurulumda, statik `/offline.html` yazilir. Hicbir
 *     ag yaniti onbellege YAZILMAZ (`cache.put` yok; `push-sw-safety` testi).
 *   - `fetch` yalnizca GET SAYFA GEZINMELERINE bakar ve her zaman once agi
 *     dener. Ag yoksa `offline.html` doner. API, _next/, gorsel istekleri hic
 *     gormez.
 *
 * 2026-09-23'e kadar yalnizca push icindi ve yalnizca bildirim acan
 * kullaniciya kuruluyordu; artik `PWARegister` herkese kurar ki kurulu
 * uygulama baglanti koptugunda tarayicinin hata sayfasini gostermesin.
 */

var OFFLINE_CACHE = "bagajpark-offline-v1";
var OFFLINE_URL = "/offline.html";

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then(function (cache) {
      // `reload`: HTTP onbelleginden bayat bir kopya degil, sunucudaki surum.
      return cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        // Yalnizca KENDI eski surumlerimiz silinir.
        return Promise.all(
          keys
            .filter(function (k) { return k.indexOf("bagajpark-offline-") === 0 && k !== OFFLINE_CACHE; })
            .map(function (k) { return caches.delete(k); })
        );
      })
      .then(function () {
        return self.registration.navigationPreload
          ? self.registration.navigationPreload.enable()
          : undefined;
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.mode !== "navigate" || req.method !== "GET") return;

  event.respondWith(
    Promise.resolve(event.preloadResponse)
      .then(function (preloaded) { return preloaded || fetch(req); })
      .catch(function () {
        return caches.match(OFFLINE_URL).then(function (offline) {
          return offline || Response.error();
        });
      })
  );
});

self.addEventListener("push", function (event) {
  if (!event.data) return;

  var payload;
  try {
    payload = event.data.json();
  } catch {
    // Sunucu duz metin gonderdiyse govde olarak kullan; bildirim yine cikar.
    payload = { title: "BagajPark", body: event.data.text() };
  }

  var title = payload.title || "BagajPark";
  var options = {
    body: payload.body || "",
    icon: "/icons/icon-192x192.png",
    /*
      Rozet Android'de TEK RENKLI MASKE olarak cizilir: yalnizca alfa kanali
      okunur. Renkli ve dolu 192px ikon bildirim cubugunda gri bir kareye
      donusuyordu (2026-09-23). Seffaf zeminde beyaz kutu sembolu.
    */
    badge: "/icons/badge-96x96.png",
    /*
      TIKLAMA HEDEFI. Sunucu (`NotificationService.sendPush`) govdede `url`
      DEGIL `bookingId` gonderiyor -- olculdu 2026-08-31:

        payload = { title, body, bookingId }

      Bu worker yalnizca `url` ariyordu, bulamayinca "/"e dusuyordu: yani
      rezervasyonuyla ilgili bildirime dokunan kullanici ANA SAYFAYA gidiyor
      ve aradigi seyi kendisi bulmak zorunda kaliyordu.

      Yol dil onekSIZ veriliyor; `src/proxy.ts` onu kullanicinin diline
      yonlendiriyor. Worker'in dili bilmesi gerekmiyor, ki zaten bilemez.
    */
    data: {
      url: payload.url || (payload.bookingId ? "/bookings/" + payload.bookingId : "/"),
    },
    tag: payload.tag || undefined,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || "/";

  /*
    Zaten açık bir sekme varsa ONA odaklan. Her bildirimde yeni sekme açmak,
    üç bildirim sonrası kullanıcıda üç BagajPark sekmesi bırakır.
  */
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clients) {
        for (var i = 0; i < clients.length; i++) {
          if (clients[i].url.indexOf(self.registration.scope) === 0) {
            return clients[i].focus().then(function (c) {
              return c.navigate ? c.navigate(target) : c;
            });
          }
        }
        return self.clients.openWindow(target);
      })
  );
});
