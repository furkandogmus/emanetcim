---
name: mobil-api-ucu
description: Web backend'e yeni mobil API ucu ekle ve Expo uygulamasına (mobile-expo) bağla — servis katmanı, mobile-dto, requireMobileUser, types.ts, React Query. Web'de olup mobilde olmayan bir özelliği taşırken kullan.
---

# Uçtan uca mobil API ucu

İki taşıyıcı (web action + mobil uç) **aynı servis gövdesini** çağırır; iş kuralı mobil
uçta yeniden yazılmaz (kök CLAUDE.md, 24 Ağustos vakası). Yazma işlemleri yalnızca
`src/services/` üzerinden; para yalnızca `PaymentService`.

## Backend (Next.js)

1. Web'deki karşılığı bul: `src/actions/` ya da `src/app/**/page.tsx` → hangi servisi
   çağırıyor? Servis yoksa önce servisi yaz, sonra web action'ını da ona bağla.
2. Uç: `src/app/api/mobile/<alan>/route.ts`. Komşu bir uçtan (örn. `bookings/`) şablonu al:
   - kimlik: `requireMobileUser` — FIRLATMAZ, `{ error }` döndürür; sonucu kontrol et,
   - gövde doğrulaması web ile aynı şemadan (örn. `src/lib/seal-payload.ts` deseni),
   - yanıt gövdesi `src/lib/mobile-dto.ts`'ten (`toXDto`); uçta elle alan listesi kurma
     (`mobile-dto.test.ts` mandalı yakalar),
   - `Decimal` → `moneyToNumber`,
   - ateşle-unut promise `.catch` taşır (`unhandled-rejection` mandalı, tavan 0).
3. `npm run typecheck && npm run lint && npm test` yeşil; mandal sayıları artmadı.

## Mobil (Expo, `mobile-expo/`)

4. Tip: `src/lib/types.ts` — alanlar DTO ile birebir (kaynağı `mobile-dto.ts`). Sözleşme
   testleri (`partner-shop-phone.test.ts` okuma, `mobile-shop-update-fields.test.ts` yazma)
   tiplerdeki ve `body: { ... }` içindeki her alanı sunucuda arar.
5. Okuma: `src/lib/queries.ts`'te `useQuery`; anahtar ailesi (`["partner", ...]` gibi)
   mutasyon sonrası doğru şeyi geçersiz kılacak şekilde seçilir.
6. Yazma: ekranda `useMutation` + `api(...)`; hata `errorMessage(err, "<ad alanı>")` ile
   çevrilir, metin `src/locales/{tr,en}.json`'a ikisine birden girer.
7. Kapı: `mobile-expo` içinde `npm run verify`. Emülatörde yerel backend'e karşı dene
   (argent), canlıya değil.

## Kontrol listesi

- [ ] Web ve mobil aynı servis fonksiyonunu çağırıyor
- [ ] DTO `mobile-dto.ts`'te, uçta elle alan yok
- [ ] `requireMobileUser` sonucu kontrol edildi
- [ ] `types.ts` alanları DTO ile aynı
- [ ] Her iki tarafta test var, mandallar artmadı
