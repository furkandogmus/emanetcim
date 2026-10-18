# BagajPark Mobil (Expo) — çalışma kuralları

Kök `CLAUDE.md` burada da geçerlidir; bu dosya yalnızca Expo kolunu ekler. Genel Expo
rehberi `AGENTS.md`'de. Tek mobil istemci budur (Flutter 2026-10-18'de kaldırıldı); uçlar
`/api/mobile` altında.

## Kapsam (MVP)

Müşteri: OTP giriş → arama sihirbazı (konum → zaman → valiz) → harita + liste →
dükkan detayı → onay → rezervasyonlarım (QR, iptal). Esnaf: gelen rezervasyonlar
(bugün / yaklaşan / geçmiş) ve detay. Rezervasyon **anında onaylı** oluşur (web ile
aynı kural, `checkout/intent` → `APPROVED`); esnaf onay adımı bilerek yok.

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

- **Ekrandaki her metin** `src/locales/{tr,en}.json`'a girer, ikisine birden. Ham sunucu
  hata metni basılmaz: `errorMessage(err, "<namespace>")` kodu çevirir.
- **Yanıt tipleri** `src/lib/types.ts` — kaynağı `../src/lib/mobile-dto.ts`. Orada alan
  değişirse burası da değişir.
- **Fiyat** istemcide yalnızca tahmindir; çarpanlar ve sigorta `shops/[id]` yanıtındaki
  `pricing`'den okunur, sabit yazılmaz (`checkout.tsx` içindeki gerekçe).
- **Harita** MapLibre + OpenFreeMap "bright" (`src/lib/map-style.ts`) — web ile
  aynı altlık. Google Maps yok. OSM atfı her haritada sabit metin olarak görünür.
- **Token yenileme** tek uçuşta (`src/lib/api.ts`): sunucu refresh token tekrarını oturum
  ailesini iptal ederek cezalandırıyor.
- Tema token'ları `src/theme/tokens.ts` — web `globals.css` kimliğinden elle aktarıldı.
- `android/` ve `ios/` üretilir (CNG), elle düzenlenmez, git'e girmez.
- **Kabul kriteri: Google Play'e yüklenebilir build.** İzin listesi, hesap silme ve
  production profili bu yüzden var; değiştirmeden önce `PLAY_YAYIN.md`'yi oku.
