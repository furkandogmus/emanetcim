# Tasks

## 1. Backend

- [ ] 1.1 `getShopByOwner(ownerId, requestedShopId?)` → `resolvePartnerShops` + `findUnique`; doğrulama: yeni `shop-by-owner.test.ts` (sabit sıra, ?shop seçimi, başkasının kimliği, dükkansız null)
- [ ] 1.2 Üç uç `req.nextUrl.searchParams.get("shop")` iletir; doğrulama: mevcut fotoğraf testi + yeni iletim testi
- [ ] 1.3 Kök kapı yeşil

## 2. Expo

- [ ] 2.1 Dükkan bilgisi, saat ve fotoğraf sorgu anahtarları ve istekleri ortak seçimi `?shop=` ile taşır; başlıkta dükkan adı; doğrulama: `npm run verify`
- [ ] 2.2 Emülatörde Galata seçiliyken fiyat değişikliği yalnızca Galata'ya yazılır (veritabanı kontrolü)
