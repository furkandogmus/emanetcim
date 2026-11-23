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

- **Ekrandaki her metin** `src/locales/{tr,en,de,ru}.json`'a girer, hepsine birden
  (`npm run check:locales` paritesi). Ham sunucu
  hata metni basılmaz: `errorMessage(err, "<namespace>")` kodu çevirir.
- **Yanıt tipleri** `src/lib/types.ts` — kaynağı `../src/lib/mobile-dto.ts`. Orada alan
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
- **Uygulama bağlantıları** yalnızca `/<dil>/shop/<id>` (`+native-intent.tsx` → `src/lib/app-link-path.ts`). Doğrulama
  dosyaları sunucuda `ANDROID_APP_LINK_SHA256` ve `APPLE_TEAM_ID` ile açılır
  (`../src/lib/app-links.ts`); boşken 404 döner ve bağlantı tarayıcıda açılır.
- Tema token'ları `src/theme/tokens.ts` — web `globals.css` kimliğinden elle aktarıldı.
- `android/` ve `ios/` üretilir (CNG), elle düzenlenmez, git'e girmez.
- **Kabul kriteri: Google Play'e yüklenebilir build.** İzin listesi, hesap silme ve
  production profili bu yüzden var; değiştirmeden önce `PLAY_YAYIN.md`'yi oku.
- **iOS yayını** `IOS_YAYIN.md`: hesap, build/submit adımları, App Review notları.
- **OTA** yalnızca `npm run update:production` ile (doğrudan `eas update` değil); varsayılan
  runtime `app.json` `version`'ı, eski ikililer `OTA_RUNTIME` ile. `PLAY_YAYIN.md` § Hızlı yayın.
