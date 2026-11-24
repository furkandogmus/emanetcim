# BagajPark Mobil (Expo) — çalışma kuralları

Kök `CLAUDE.md` burada da geçerlidir; bu dosya yalnızca Expo kolunu ekler. Genel Expo
rehberi `AGENTS.md`'de. Tek mobil istemci budur (Flutter 2026-10-18'de kaldırıldı); uçlar
`/api/mobile` altında.

## Kapsam

Müşteri: e-posta kodu / şifre / Google (Android) / Apple (iOS) ile giriş → arama sihirbazı
(konum → zaman → valiz) → harita + liste → dükkan detayı → onay → rezervasyonlarım (QR,
değiştir, iptal, değerlendirme, itiraz). Esnaf: pano, gelen rezervasyonlar, QR okutup teslim
al / teslim et, mühür, kazanç, dükkan ayarları. Yönetici: rezervasyonlar, dükkanlar,
kullanıcılar, duyuru, itiraz, kupon, ödeme, platform ayarları ve bayraklar. Ekran listesi ve
durum: `migration-progress.md`. Rezervasyon **anında onaylı** oluşur (web ile aynı kural,
`checkout/intent` → `APPROVED`); esnaf onay adımı bilerek yok.

## Komutlar (mobile-expo/ içinden)

```bash
npm run verify                         # kapı: typecheck + lint + locale paritesi + jest (CI ile aynı)
npm test                               # jest-expo birim testleri (src/**/__tests__)
npx expo run:android                   # development build (MapLibre native modül → Expo Go YETMEZ)
npx expo start                         # build kuruluysa yalnızca JS için Metro
```

API adresi derleme anında: `EXPO_PUBLIC_API_BASE_URL` (varsayılan emülatör için
`http://10.0.2.2:3000/api/mobile`). Varsayılan bilerek üretim DEĞİL.

## Kurallar

- **Ekrandaki her metin** `src/locales/{tr,en,de,ru,fr,ja,fa}.json`'a girer, hepsine birden
  (`npm run check:locales` paritesi). Ham sunucu
  hata metni basılmaz: `errorMessage(err, "<namespace>")` kodu çevirir.
- **Yanıt tipleri** `src/lib/types/` (alan başına dosya, adlar `../src/lib/mobile-dto/` ile aynı),
  sorgu kancaları `src/lib/queries/`; ikisi de `index.ts` ile `@/lib/types` / `@/lib/queries`
  yolundan ithal edilir. Yönetici özetindeki araç bağlantıları `src/lib/admin-tools/` kaydında;
  ekrana elle satır eklenmez. Kaynakta alan
  değişirse burası da değişir.
- **Fiyat istemcide hesaplanmaz.** Ödeme ekranı `checkout/quote`, değiştirme ekranı
  `bookings/[id]/modify?preview=1` yanıtını gösterir (satırlar, sigorta, toplam).
  "Tahmini" tutar yazılmaz: iki ayrı formül ayrışınca misafir bir tutar görüp başkasını öder.
- **Harita** MapLibre + OpenFreeMap "bright" (`src/lib/map-style.ts`) — web ile
  aynı altlık. Google Maps yok. OSM atfı her haritada sabit metin olarak görünür.
- **Token yenileme** tek uçuşta (`src/lib/api.ts`): sunucu refresh token tekrarını oturum
  ailesini iptal ederek cezalandırıyor.
- **iOS bildirimi Expo push'tan gider.** iOS'ta yerel token APNs'indir, sunucunun FCM
  yolu onu almaz: `src/lib/push.ts` iOS'ta Expo push token'ı kaydeder, sunucu
  `../src/lib/expo-push.ts` ile gönderir. Android FCM'de kalır. APNs anahtarı EAS
  kimlik bilgilerinde durur (`eas credentials -p ios`).
- **Apple ile giriş** düğmesi `app.json` → `extra.appleSignIn` ile açılır (2026-11-23'ten
  beri `true`); sunucu kimlik belirtecini `APPLE_BUNDLE_ID` = `com.bagajpark` ile doğrular.
  Kapatırsan iOS'ta Google girişi de kapalı kalmalı (App Review 4.8).
- **Uygulama bağlantıları** iOS'ta `APP_LINK_PATHS` (`../src/lib/app-links.ts`), Android'de
  `app.json` `intentFilters` (dükkan, UUID'li rezervasyon, esnaf rezervasyonu, aracı paneli;
  `/register` Android'de yok, filtre sorguyu okuyamaz); ikisi `../src/__tests__/app-links.test.ts`
  ile denetlenir. Yol çevirisi `+native-intent.tsx` → `src/lib/app-link-path.ts`. Doğrulama
  dosyaları sunucuda `ANDROID_APP_LINK_SHA256` ve `APPLE_TEAM_ID` ile açılır
  (`../src/lib/app-links.ts`); boşken 404 döner ve bağlantı tarayıcıda açılır.
- **Farsça sağdan sola** (`src/lib/rtl.ts`): yön uygulama dilinden gelir, dil değişince yeniden
  yükler. `expo-localization` `supportsRTL` bilerek kapalı (iOS her açılışta cihaz yönüne
  döndürüyor). Yöne bağlı ikon `style={flipInRtl}`. `left`/`right` stilleri ve `textAlign` RTL'de iki
  platformda da (Fabric) çevrilir: `"right"` RTL'de sola hizalar, elle ters çevirme.
- **0.3.6 yerel modülleri** (Sentry, `expo-local-authentication`, `expo-calendar`) eski ikilide
  yok: JS onları `requireOptionalNativeModule` ile sezer, yoksa özellik kapalı ya da eski yola
  düşer (takvim → Google Takvim bağlantısı). Doğrudan üst düzey `import` eski ikiliye giden
  OTA'yı açılışta düşürür.
- **Sentry** (`src/lib/sentry.ts`): `EXPO_PUBLIC_SENTRY_DSN` yoksa tamamen kapalı. Olay
  `sentry-scrub.ts`'ten geçer (e-posta/telefon/jeton/gövde). Kaynak haritası yüklemesi ve
  eklenti yalnız `SENTRY_AUTH_TOKEN` olan derlemede (`app.config.js`).
- **Uygulama kilidi** (`components/AppLockGate.tsx`): yönetici varsayılan açık, esnaf
  isteğe bağlı, misafir hiç; soğuk açılış ve 5 dk+ arka plan, taze girişte değil. Görüntülemede
  tercih yöneticinin kimliğiyle. Cihazda biyometri/kod yoksa (ya da kilitliyken kaldırılırsa)
  kilit yok. Kilit kendi tam ekran `Modal`'ında: kök modal ekranları kapatıp açılınca geri
  açar, `Sheet` kilitliyken sunulmaz. Kilit ekranında her zaman "çıkış yap" var.
- Tema token'ları `src/theme/tokens.ts` — web `globals.css` kimliğinden elle aktarıldı.
- `android/` ve `ios/` üretilir (CNG), elle düzenlenmez, git'e girmez.
- **Kabul kriteri: Google Play'e yüklenebilir build.** İzin listesi, hesap silme ve
  production profili bu yüzden var; değiştirmeden önce `PLAY_YAYIN.md`'yi oku.
- **iOS yayını** `IOS_YAYIN.md`: hesap, build/submit adımları, App Review notları.
- **OTA** yalnızca `npm run update:production` ile (doğrudan `eas update` değil); varsayılan
  runtime `app.json` `version`'ı, eski ikililer `OTA_RUNTIME` ile. `PLAY_YAYIN.md` § Hızlı yayın.
