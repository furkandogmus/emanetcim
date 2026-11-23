# Tasks

## 1. Backend

- [x] 1.1 Üç uçta `findFirst` yerine `resolvePartnerShops(userId, ?shop=)`; GET yanıtına `shop`; doğrulama: yeni test (varsayılan, ?shop iletimi, dükkansız 404 `no_shop`), mevcut mühür testleri yeşil
- [x] 1.2 Kök kapı yeşil, mandallar artmadı

## 2. Expo

- [x] 2.1 Paylaşılan dükkan seçimi (`PartnerShopProvider` + `usePartnerShopId`), `(partner)/_layout.tsx`'te; özet kartı yerel state yerine bunu kullanır; doğrulama: typecheck
- [x] 2.2 Mühür ekranı: sorgu anahtarı ve üç istek `?shop=` taşır, başlıkta dükkan adı; doğrulama: emülatörde Galata seçiliyken mühür ekranı Galata stoğunu (37 hazır), Sultanahmet seçiliyken 0 gösterir
