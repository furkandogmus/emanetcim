# iOS yayını (App Store)

Apple Developer hesabı: Bireysel (Individual), Team ID `524ZQ83Q42`. App Store'da satıcı adı
hesap sahibinin adı olarak görünür; şirket adı için kurumsal hesaba geçmek gerekir.

## Bir kez yapılacaklar (hesap sahibi)

1. App Store Connect kullanım şartlarını kabul et (appstoreconnect.apple.com ilk girişte sorar).
2. İlk build, Apple ID girişi ister; EAS bundle ID'yi (`com.bagajpark`), dağıtım sertifikasını,
   provisioning profile'ı ve push (APNs) anahtarını kendisi oluşturur, Push / Sign in with Apple /
   Associated Domains yetkilerini entitlements'tan açar:

   ```bash
   cd mobile-expo && npx eas build -p ios --profile production
   ```

3. Yükleme. `ascAppId` henüz yok; ilk `submit` App Store Connect'te uygulama kaydını oluşturmayı
   önerir, oluşan id `eas.json` → `submit.production.ios.ascAppId`'ye yazılır:

   ```bash
   npx eas submit -p ios --profile production --latest
   ```

## Sunucu

- `APPLE_TEAM_ID` ve `APPLE_BUNDLE_ID` `docker-compose.yml`'de varsayılanlı; `/.well-known/apple-app-site-association`
  bunlarla açılır, `bagajpark.com/<dil>/shop/<id>` bağlantıları uygulamada açılır.
- Google ile giriş iOS'ta kapalı (`src/lib/google-auth.ts` yalnızca Android). Açmak için Google
  Cloud'da iOS OAuth istemcisi, sunucuda `GOOGLE_IOS_CLIENT_ID`, `app.json`'da google-signin
  eklentisine `iosUrlScheme` gerekir. Google girişi iOS'ta açılırsa Apple ile giriş zorunludur
  (App Review 4.8); Apple ile giriş zaten açık (`extra.appleSignIn`).

## App Review notları

- Ödeme uygulamada alınmaz, dükkânda yapılır (fiziksel hizmet): uygulama içi satın alma gerekmez.
- Hesap silme uygulamada var (Profil → Hesabı sil); 5.1.1(v) bunu ister.
- İnceleme için bir misafir ve bir esnaf test hesabı "App Review Information" alanına yazılır;
  esnaf hesabı QR okutma ve check-in akışını göstermek için gerekir.
- İzin metinleri Türkçe (`app.json` eklenti ayarları). "Always" konum ve hareket metinleri yalnızca
  expo-location kütüphanesi bu API'leri içerdiği için var; uygulama arka planda konum istemez.
