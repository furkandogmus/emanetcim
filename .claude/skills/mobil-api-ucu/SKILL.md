---
name: mobil-api-ucu
description: Web backend'e yeni mobil API ucu ekle ve Flutter tarafına bağla — servis katmanı, mobile-dto, requireMobileUser, retrofit client, repository, freezed model. Web'de olup mobilde olmayan bir özelliği taşırken kullan.
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
4. `mobile/README.md` "Bağlanan backend endpoint'ler" listesine satır ekle.

## Mobil (Flutter)

5. Model: `lib/shared/models/<ad>.dart` — freezed + json_serializable, alanlar DTO ile
   birebir (`camelCase`, nullable olanlar `?`). `dart run build_runner build --delete-conflicting-outputs`.
6. Repository: `lib/core/repositories/<alan>_repository.dart` — `dioProvider` üzerinden,
   mevcut repository'lerin hata sarma desenini koru. Ekran `Dio` görmez.
7. Provider/notifier ve ekran: `/mobil-ekran`.
8. Test: repository için `test/repositories/` altında mock Dio ile başarı + 401 + ağ hatası;
   yanıt JSON'unu backend DTO'sundan türet, uydurma.
9. Kapı: `/mobil-dogrula`. Gerçek cihazda yerel backend'e karşı dene (`/mobil-cihaz`),
   canlıya değil.

## Kontrol listesi

- [ ] Web ve mobil aynı servis fonksiyonunu çağırıyor
- [ ] DTO `mobile-dto.ts`'te, uçta elle alan yok
- [ ] `requireMobileUser` sonucu kontrol edildi
- [ ] Freezed model alanları DTO ile aynı
- [ ] Her iki tarafta test var, mandallar artmadı
