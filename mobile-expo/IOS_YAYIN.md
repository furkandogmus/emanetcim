# iOS yayını (App Store)

**Son durum (2026-11-23):** sürüm 0.3.4 (build 4) App Review'da; yalnızca Türkiye, onaylanınca
otomatik yayın. TestFlight dahili grubunda iPhone'da kurulup denendi. Build 3 geri çekildi
(gömülü JS, inceleme hesabının demo dükkanını ilk açılışta göstermiyordu).

| | |
|---|---|
| Hesap | Apple Developer, bireysel (Individual), Team ID `524ZQ83Q42`. Satıcı adı hesap sahibinin adı olarak görünür; şirket adı için kurumsal hesap gerekir |
| Bundle ID | `com.bagajpark` |
| App Store Connect app id | `6838203193` (mağaza bağlantıları `src/lib/app-stores-shared.ts`) |
| Sürüm | `app.json` → `version`; build numarasını EAS sunucuda tutar (`appVersionSource: remote`, `autoIncrement`) |

Makinede Xcode yok; derleme ve yükleme EAS bulutunda. İlk build/submit Apple ID girişi istediği
için hesap sahibinin Terminal'inden çalışır, sonrakiler etkileşimsizdir.

## Derleme ve yükleme

EAS bundle ID'yi, dağıtım sertifikasını, provisioning profile'ı ve push (APNs) anahtarını kendisi
yönetir; Push / Sign in with Apple / Associated Domains yetkileri entitlements'tan açılır.

```bash
cd mobile-expo && npx eas-cli@latest build -p ios --profile production
npx eas-cli@latest submit -p ios --profile production --latest
```

`eas.json` → `submit.production.ios` `appleTeamId` ve `ascAppId` (`6838203193`) taşır; `submit`
uygulamayı App Store Connect'te aramaz, doğrudan o kayda yükler.

Yalnızca JS/görsel değişikliği derleme istemez; OTA ile gider (`PLAY_YAYIN.md` § Hızlı yayın —
iki platform aynı kanalı ve runtime'ı kullanır).

## Sunucu

- **Uygulama bağlantıları:** `/.well-known/apple-app-site-association`, `APPLE_TEAM_ID`
  (varsayılan `524ZQ83Q42`) ve `APPLE_BUNDLE_ID` (varsayılan `com.bagajpark`) ile açılır
  (`docker-compose.yml`, `src/lib/app-links.ts`); `bagajpark.com/<dil>/shop/<id>` uygulamada açılır.
- **Apple ile giriş:** iOS'ta yerel (`extra.appleSignIn: true`), web'de Auth.js Apple sağlayıcısı.
  Web'in istemci kimliği Services ID'dir (`APPLE_ID`); istemci sırrı süreç başında `.p8`
  anahtarından üretilir (`APPLE_PRIVATE_KEY_B64` + `APPLE_KEY_ID` + `APPLE_TEAM_ID`,
  `src/lib/auth-providers.ts`), çünkü elle üretilen sır 6 ayda sessizce biter. Anahtar SSM'de
  SecureString (`ops/SECRETS.md`). Apple'ın e-posta aktarımı için kök alan adında SPF kaydı var.
- **Google ile giriş iOS'ta kapalı** (`mobile-expo/src/lib/google-auth.ts` yalnızca Android).
  Açmak için Google Cloud'da iOS OAuth istemcisi, sunucuda `GOOGLE_IOS_CLIENT_ID`, `app.json`'da
  google-signin eklentisine `iosUrlScheme` gerekir. Apple ile giriş zaten açık olduğundan
  App Review 4.8 şartı karşılanır.
- **iOS bildirimi** Expo push üzerinden (`src/lib/expo-push.ts`); APNs anahtarı EAS kimlik
  bilgilerinde (`eas credentials -p ios`).

## App Review notları

- Ödeme uygulamada alınmaz, dükkânda yapılır (fiziksel hizmet): uygulama içi satın alma gerekmez.
- Hesap silme uygulamada var (Profil → Hesabı sil); 5.1.1(v) bunu ister.
- İnceleme için bir misafir ve bir esnaf test hesabı "App Review Information" alanına yazılır;
  esnaf hesabı QR okutma ve check-in akışını göstermek için gerekir. Hesapların kendisi
  Keychain'de, repoda değil.
- İnceleme hesabı `User.reviewSandbox` bayrağı taşır (mobil admin → Kullanıcılar → test hesabı
  anahtarı); yalnızca bu hesaplar `isTest` demo dükkanlarını görür ve rezerve eder
  (`src/lib/public-shop-filter.ts`). Gerçek misafir demo dükkanı görmez.
- Web ve e-postadaki App Store bağlantıları, admin → Platform ayarları → "iOS yayında" bayrağı
  açılınca görünür; onaydan önce açılmaz.
- İzin metinleri `app.json` eklenti ayarlarında, dilleri `ios-locales/`. "Always" konum ve hareket
  metinleri yalnızca expo-location kütüphanesi bu API'leri içerdiği için var; uygulama arka
  planda konum istemez.
