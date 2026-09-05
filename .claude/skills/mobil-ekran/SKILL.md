---
name: mobil-ekran
description: Flutter uygulamasına yeni ekran/özellik ekle — feature klasörü, Riverpod state, go_router rotası, tr+en çeviri anahtarları, harness'lı widget + a11y testi. "Mobilde X ekranı yap" isteklerinde kullan.
---

# Yeni mobil ekran

Argüman: ekran adı ve amacı (örn. `/mobil-ekran privacy — gizlilik ve veri hakları`).
Web'de karşılığı varsa (`docs/web_vs_mobile_comparison.md` "Fark (Gap)" satırları) önce
web sayfasını oku ve aynı iş kuralını uygula; kuralı yeniden icat etme.

## Adımlar

1. **Örnek oku, tahmin etme.** Benzer bir ekranı aç (basit: `features/profile/profile_screen.dart`,
   listeli: `features/booking/my_bookings_screen.dart`, form: `features/auth/login_screen.dart`).
   Yapıyı, `ConsumerStatefulWidget` + `analyticsServiceProvider.logScreenView('Ad')`
   desenini ve `AppColors` kullanımını oradan al.
2. **Veri gerekiyorsa** repository katmanından geç (`core/repositories/`); ekran içinde
   `Dio` çağırma. Yeni uç gerekiyorsa önce `/mobil-api-ucu`.
3. **Dosyalar:** `lib/features/<ad>/<ad>_screen.dart` (+ gerekirse `widgets/`,
   `<ad>_controller.dart` Riverpod notifier).
4. **Rota:** `lib/app/router.dart` — mevcut `GoRoute` listesine ekle; rol gerektiren
   ekran `/partner/...` ya da `/admin/...` öneki alır, redirect mantığı önekten çalışır.
   `Navigator.push` yazma, `context.push('/yol')`.
5. **Metinler:** her anahtar `assets/l10n/tr.json` VE `assets/l10n/en.json`'a, ilgili
   üst anahtarın altına (`profile.*`, `booking.*` ...). Widget'ta `'anahtar'.tr()`.
   Sabit Türkçe/İngilizce metin yazma. İki dosyada aynı anahtar setini koru.
6. **Test:** `test/features/<ad>/<ad>_screen_test.dart`. `test/support/harness.dart`
   içindeki `pumpApp(tester, widget, device:, textScale:)` ile pump et; Riverpod
   bağımlılıklarını `overrides:` ile mock'la (`mocktail`). Zorunlu asgari:
   - ekran çizilir ve başlık metni GERÇEK çeviriyle görünür (ham anahtar değil),
   - `kDeviceMatrix` × `textScale: 2.0` taşma yok (`tester.takeException()` null),
   - `meetsGuideline(androidTapTargetGuideline)`, `labeledTapTargetGuideline`,
     `textContrastGuideline` (örnek: `test/features/search/shop_preview_card_a11y_test.dart`).
7. **Kapı:** `/mobil-dogrula`. Görsel iş: `/mobil-cihaz` ile screencap al ve bak.
8. `docs/web_vs_mobile_comparison.md`'de ilgili satır varsa durumunu güncelle.

## Yapma

- `MediaQuery.of(context).size.width * x` ile genişlik alma; `LayoutBuilder`/constraints.
- `use_build_context_synchronously`: `await` sonrası `if (!mounted) return;` (State'in
  kendi `mounted`'ı, `context.mounted` değil).
- Deprecated API: `activeColor`→`activeThumbColor`, `DropdownButtonFormField(value:)`→`initialValue:`.
