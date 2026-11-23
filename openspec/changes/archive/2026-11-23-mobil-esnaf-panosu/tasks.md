# Tasks

## 1. Backend

- [x] 1.1 `toMobilePartnerDashboard` DTO (`mobile-dto.ts`); doğrulama: `mobile-dto.test.ts` yeşil
- [x] 1.2 `GET /api/mobile/partner/dashboard` (requireMobileUser + PARTNER, resolvePartnerShops, getEffectiveCommission, getSnapshot); doğrulama: yeni test (200 + servise doğru argümanlar, ?shop seçimi, GUEST 403, dükkansız 404)
- [x] 1.3 Kök kapı: `npm run typecheck && npm run lint && npm test` yeşil, mandallar artmadı

## 2. Expo

- [x] 2.1 `PartnerDashboard` tipi + `usePartnerDashboard` sorgusu; doğrulama: typecheck
- [x] 2.2 `PartnerPulseCard` (4 sayı, aylık değişim yalnızca `monthChangePct != null`), tr/en metinler, erişilebilir özet etiketi; doğrulama: `npm run verify`
- [x] 2.3 `partner/index.tsx` üstüne kart; çekip yenilemede kart da yenilenir; hata satırı listeyi engellemez; doğrulama: emülatörde esnaf girişi, teslim al sonrası "elde duran" artar
