## Why

Expo uygulaması ADMIN rolündeki kullanıcıyı misafir ekranlarına yönlendiriyor; Flutter'daki
admin ekranları (pano, esnaf başvuruları, iletişim mesajları) Expo'da yok. Flutter Play'den
kalktığı için (2026-10-18, dahili test izi Expo 0.1.0) admin mobilden başvuru onaylayamıyor.

Mobil admin uçları var ama web'den ayrışmış: dükkan reddi (dükkanı SİLER) denetim kaydı
yazmıyor, hatalar çevrilemeyen İngilizce cümle, başvuru listesi ham Prisma kaydı, olmayan
mesajda 500.

## What Changes

1. **Sunucu** — `admin/applications/[id]/[action]` web action'larıyla aynı denetim kaydını
   yazar ve hata kodu döner; başvuru listesi `mobile-dto.ts` DTO'su; mesaj uçları olmayan
   kayıtta 404.
2. **Expo** — ADMIN girişte `(admin)` grubuna yönlenir: pano, başvurular (onayla/reddet;
   reddet yıkıcı onay ister), mesajlar (okundu/sil).

## Capabilities

### New Capabilities
- `mobile-admin`: Mobil admin paneli: sayılar, esnaf başvuruları, iletişim mesajları

## Impact

- **API**: `src/app/api/mobile/admin/**`, `src/lib/mobile-dto.ts`
- **Mobile**: `mobile-expo/src/app/(admin)/`, `mobile-expo/src/app/_layout.tsx` (rol kapısı)
- **Test**: `src/__tests__/mobile-api.test.ts` (denetim kaydı, hata kodları, 404)
- **Doğrulama**: prod'da `maestro-admin` (şifre Keychain `bagajpark-test/admin`); başvuru
  onayı/reddi YALNIZCA test hesabına ait başvuruda denenir
