## Why

Android'de Play dahili testten indiren kullanıcı "Google ile giriş yap" görmüyor
(2026-10-18). Sunucu ucu (`POST /api/mobile/auth/google`) hazır ve sitenin kullandığı
web istemci kimliğini (Firebase projesi `bagajpark-694ad`) kabul ediyor; Expo
uygulamasında ise Google girişi hiç yok. Firebase Android uygulamasına Play imzalama,
yükleme ve debug SHA-1'leri 2026-10-18'de eklendi; eksik olan istemci tarafı.

Ayrıca ucun bir yapılandırma açığı var: kabul edilen istemci kimliklerinin hiçbiri
tanımlı değilse `audience` kontrolü kapanıyor ve herhangi bir uygulamanın Google token'ı
kabul ediliyor. Canlıda web kimliği tanımlı, ama yapılandırma eksikliği sessizce açık
kapı yaratmamalı.

## What Changes

- Expo giriş ekranına "Google ile devam et" düğmesi (Android); yerel Google hesap seçici
  (`@react-native-google-signin/google-signin`), alınan ID token `auth/google`'a gider,
  oturum diğer girişlerle aynı yoldan açılır.
- Web istemci kimliği derleme anında `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` ile verilir
  (gizli değil); tanımsızsa düğme hiç gösterilmez.
- Sunucu: kabul edilen istemci kimliği yoksa uç `503 google_not_configured` döner, token
  doğrulanmaz.
- iOS bu değişikliğin dışında (Apple Developer hesabı ve iOS istemci kimliği bekliyor).

## Capabilities

### New Capabilities
- `mobile-google-sign-in`: Mobil uygulamada Google hesabıyla giriş ve sunucudaki token doğrulama kuralları

### Modified Capabilities

## Impact

- **API**: `src/app/api/mobile/auth/google/route.ts`, test
- **Mobile**: `mobile-expo/package.json`, `app.json` (config plugin), `eas.json` (env),
  `src/lib/auth.tsx`, `src/app/login.tsx`, locale dosyaları
- **Yayın**: native modül → yeni development build ve yeni Play sürümü gerekir
