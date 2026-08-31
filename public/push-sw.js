/*
 * Yalnızca PUSH için service worker.
 *
 * BİLEREK `fetch` DİNLEYİCİSİ YOK. 2026-08-23'te eski service worker kaldırıldı
 * çünkü yetkili API yanıtlarını önbelleğe alıyordu — yani bir kullanıcının
 * verisi başka bir oturumda geri servis edilebiliyordu. `fetch` olayına hiç
 * abone olmayan bir worker tek bir isteği bile göremez, dolayısıyla o sınıf
 * hata burada yapısal olarak imkânsız.
 *
 * Bu dosya yalnızca kullanıcı bildirimleri AÇTIĞINDA kaydedilir
 * (`WebPushOptIn`), herkese kurulmaz.
 */

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
    badge: "/icons/icon-192x192.png",
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
