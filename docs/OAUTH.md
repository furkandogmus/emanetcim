# OAuth girişleri (Google, Apple)

Web girişi Auth.js v5 (`src/auth.config.ts`), mobil giriş ayrı JWT uçları
(`src/app/api/mobile/auth/{google,apple}`). Sırlar AWS SSM Parameter Store'da durur ve
sunucudaki env dosyasına `scripts/secrets-render.sh` ile yazılır (`ops/SECRETS.md`);
compose bu anahtarları `docker-compose.yml`'de açıkça listeler. Yerel geliştirmede
değerler `docker-compose.env` dosyasına girer (şablon `docker-compose.env.example`).

## Son durum — 2026-11-23

| Giriş | Web | Mobil |
|---|---|---|
| E-posta + şifre | açık | açık (şifre sıfırlama kodu uygulamada girilir) |
| Google | açık | açık (iOS / Android istemci id'leri) |
| Apple | açık (Services ID `com.bagajpark.web`) | açık, yalnız iOS (bundle `com.bagajpark`) |
| SMS kodu | kapalı | kapalı (`SMS_LOGIN_ENABLED=true` ile tek yerden açılır) |

## Google

| Anahtar | Ne |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Web OAuth istemcisi (Google Cloud Console → Credentials) |
| `GOOGLE_IOS_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID` | Mobil token'ın kabul edilen audience'ları |

Web istemcisinin yetkili yönlendirme adresleri:
`http://localhost:3000/api/auth/callback/google` ve
`https://bagajpark.com/api/auth/callback/google`.

## Apple

| Anahtar | Ne |
|---|---|
| `APPLE_ID` | Web Services ID (`com.bagajpark.web`) |
| `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY_B64` | "Sign in with Apple" anahtarının id'si ve base64'lenmiş `.p8` içeriği (SSM) |
| `APPLE_TEAM_ID` | Apple Developer Team ID; compose varsayılanı `524ZQ83Q42`. AASA (`/.well-known/apple-app-site-association`) de bunu kullanır |
| `APPLE_BUNDLE_ID` | Mobil token'ın audience'ı, varsayılan `com.bagajpark` |
| `APPLE_SECRET` | Eski kurulum: elle üretilmiş istemci sırrı. Doluysa önceliklidir; boş bırakın |

Apple'ın istemci sırrı `.p8` ile imzalı, en fazla 6 ay geçerli bir ES256 JWT'dir. Elle
üretilip env'e yazılınca 6 ayda bir sessizce biter; bu yüzden uygulama sırrı süreç
içinde anahtardan üretir ve 30 günde bir yeniden imzalar (`src/lib/auth-providers.ts`).
Anahtar bozuksa Apple düğmesi gizlenir, sunucu düşmez.

Services ID'nin "Return URL"i: `https://bagajpark.com/api/auth/callback/apple`. Apple
localhost kabul etmez; yerelde Apple girişi denenmez. Alan adı doğrulaması ve e-posta
iletimi için `bagajpark.com` kökünde SPF kaydı var. Mağaza tarafı:
`mobile-expo/IOS_YAYIN.md`.

## Demo girişleri

Geliştirmede (ve prod dışında `NEXT_PUBLIC_ENABLE_AUTH_DEMO=true` ile) giriş ekranında
hızlı demo hesapları görünür. Prod'da kapalıdır.

## Test

Elle test listesi tutulmaz: kritik akışlar Playwright'ta (`tests/e2e/`, `npm run test:e2e`),
iş kuralları Vitest'te.
