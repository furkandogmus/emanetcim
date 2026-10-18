## Why

`mobile-expo` kapısı (`npm run verify`, `mobile-expo-ci.yml`) yalnızca typecheck ve
tr/en anahtar paritesine bakıyor. `npx expo lint` çalışıyor gibi görünüyor ama
yapılandırma olmadığı için `src/` altındaki her dosyayı yok sayıyor (2026-10-18'de
ölçüldü: "all of the files matching the glob pattern ... are ignored"). Test hiç yok.
Token yenilemenin tek uçuşta kalması, hata kodlarının çevrilmesi ve fiyat tahmini
gibi para/oturum davranışları regresyona tamamen açık.

## What Changes

- `mobile-expo`'ya ESLint yapılandırması (`eslint-config-expo`); lint `src/`'yi gerçekten tarar
  ve hatasız geçer.
- `jest-expo` ile birim test altyapısı; `npm test` komutu.
- İlk testler: token yenileme tek uçuş (iki eşzamanlı 401 → tek `auth/refresh`),
  yenileme başarısızsa oturumun düşmesi, `errorMessage` kod çevirisi, fiyat tahmini.
- `npm run verify` = typecheck + lint + test + locale paritesi; `mobile-expo-ci.yml`
  bunu zaten çağırıyor, iş adı güncellenir.

## Capabilities

### New Capabilities
- `mobile-expo-quality-gate`: Expo uygulamasının birleştirme öncesi geçmesi gereken
  otomatik kapı (lint, tip, birim test, çeviri paritesi) ve kapının koruduğu davranışlar

### Modified Capabilities

## Impact

- **Mobile**: `mobile-expo/package.json`, `mobile-expo/eslint.config.js`,
  `mobile-expo/jest` yapılandırması, `mobile-expo/src/**/__tests__/`
- **CI**: `.github/workflows/mobile-expo-ci.yml` (iş adı; komut aynı)
- Backend'e ve uygulama davranışına dokunulmaz; lint'in yakaladığı gerçek hatalar
  ayrı commit'lerle düzeltilir.
