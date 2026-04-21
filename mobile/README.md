# BagajPark Mobile (Flutter)

Monorepo'nun mobil kolu. iOS + Android. Backend: `../src/app/api/mobile/*`.

## Gereksinimler

- Flutter 3.24+ (`brew install --cask flutter`)
- Xcode 15+ (iOS)
- Android Studio + SDK 34 (Android)
- CocoaPods 1.15+ (`brew install cocoapods`)
- Firebase CLI + FlutterFire CLI (push için): `dart pub global activate flutterfire_cli`

## İlk kurulum

```bash
cd mobile

# Platform klasörleri oluştur (ios/, android/, macos/, web/, ...)
# pubspec + lib/ korunur
flutter create --org com.bagajpark --platforms=ios,android --project-name bagajpark .

# Bağımlılık kur
flutter pub get

# freezed + json_serializable generate
dart run build_runner build --delete-conflicting-outputs

# Firebase (push + auth)
flutterfire configure --project=bagajpark
```

## Çalıştırma

```bash
# Dev (local API)
flutter run --dart-define=API_BASE_URL=http://localhost:3000/api/mobile \
            --dart-define=STRIPE_PK=pk_test_... \
            --dart-define=FIREBASE_ENABLED=false

# iOS simulator
flutter run -d "iPhone 15"

# Android emulator
flutter run -d emulator-5554
```

## Env değişkenleri (dart-define)

| Değişken | Açıklama |
|----------|----------|
| `API_BASE_URL` | Backend mobile API kökü (örn. `https://bagajpark.com/api/mobile`) |
| `STRIPE_PK` | Stripe publishable key |
| `SENTRY_DSN` | Crash reporting |
| `FIREBASE_ENABLED` | true ise push aktif |
| `MAP_TILE_URL` | CARTO Voyager default |

## Backend gereksinimi

### Env

```
MOBILE_JWT_SECRET=<32+ random, openssl rand -base64 32>
GOOGLE_CLIENT_ID=<web client id>
GOOGLE_IOS_CLIENT_ID=<ios oauth client id>
GOOGLE_ANDROID_CLIENT_ID=<android oauth client id>
APPLE_BUNDLE_ID=com.bagajpark.mobile
```

### Prisma migration

Yeni `MobilePushToken` tablosu:

```bash
npx prisma migrate dev --name mobile_push_token
```

## Yapı

```
lib/
├── main.dart          # entry, Sentry/Stripe/Firebase init
├── app/               # router, theme
├── core/              # api, auth, config
├── features/          # auth, search, booking, checkout, qr, partner, profile
└── shared/            # models (freezed), widgets, utils
```

## Build (release)

```bash
# iOS archive
flutter build ipa --release \
  --dart-define=API_BASE_URL=https://bagajpark.com/api/mobile \
  --dart-define=STRIPE_PK=pk_live_...

# Android AAB
flutter build appbundle --release \
  --dart-define=API_BASE_URL=https://bagajpark.com/api/mobile
```

## CI

Codemagic veya Fastlane — TestFlight + Play Internal track. Kurulum ayrı ticket.

## Durum

Phase 1 — S1 + S2/S3 temel iş mantığı hazır.

**Bağlanan backend endpoint'ler:**
- `POST /api/mobile/auth/otp` `/session` `/refresh` — email OTP
- `GET /api/mobile/auth/me`
- `POST /api/mobile/auth/google` — Google ID token verify (jose JWKS)
- `POST /api/mobile/auth/apple` — Apple ID token verify (jose JWKS)
- `GET /api/mobile/shops/nearby?lat&lng&r` — `ShopService.findNearby`
- `GET /api/mobile/shops/[id]` — `ShopService.getShopDetails`
- `GET /api/mobile/bookings/me` — `BookingService.getUserBookings`
- `GET /api/mobile/bookings/[id]`
- `GET /api/mobile/partner/bookings` — tüm sahip olunan dükkanlar
- `POST /api/mobile/checkout/intent` — booking + Stripe PaymentIntent
- `POST /api/mobile/seals/scan` — QR (booking token veya seal serial)
- `POST/DELETE /api/mobile/push/register` — FCM token kayıt

**Eksikler (sırayla):**
- `flutter create` ile platform klasörleri (ios/, android/)
- `flutter pub get` + `dart run build_runner build` (freezed gen)
- `npx prisma migrate dev --name mobile_push_token`
- Firebase config (`GoogleService-Info.plist`, `google-services.json`)
- iOS Info.plist: Sign in with Apple capability, `NSCameraUsageDescription` (QR), `NSLocationWhenInUseUsageDescription`
- Android `AndroidManifest.xml`: CAMERA, INTERNET, ACCESS_FINE_LOCATION izinleri
- Stripe Connect hesap onayı gerektiren dükkanlar için checkout/intent hata kodu `gateway_not_stripe` / `stripe_not_configured` dönebilir — mobilde UX ekle
- Booking iptal + modify endpoint'leri (ileri sprint)
