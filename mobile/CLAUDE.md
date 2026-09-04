# BagajPark Mobil (Flutter) — çalışma kuralları

Kök `CLAUDE.md` burada da geçerlidir; bu dosya yalnızca mobil kolu ekler. Backend
uçları `../src/app/api/mobile/*`, mobil DTO'lar `../src/lib/mobile-dto.ts`.

## Komutlar (mobile/ içinden)

```bash
scripts/verify.sh                    # analyze + test + biçim + mandal; her değişiklikten sonra
flutter analyze --no-fatal-infos     # CI ile aynı bayrak; info düşürmez, warning/error düşürür
flutter test                         # tek dosya: flutter test test/features/search/x_test.dart
dart run build_runner build --delete-conflicting-outputs   # freezed/retrofit/riverpod üretimi
dart format <dosya>                  # Edit hook'u .dart dosyalarını zaten otomatik biçimler
scripts/device.sh --screencap        # gerçek cihazdan ekran görüntüsü (build/screenshots/)
```

Yerel API için `flutter run` HER ZAMAN `--dart-define=API_BASE_URL=...` ister;
`Env.apiBaseUrl` varsayılanı üretimdir ve PreToolUse hook'u define'sız
`flutter run`'ı engeller. Cihaz/API adresi `mobile/.device.env` (gitignored,
şablon: `scripts/device.env.example`).

## Mandal (ratchet) — sayı düşebilir, yükselemez

| Ölçüm | Kaynak | Tavan |
|---|---|---|
| `flutter analyze` issue sayısı | `scripts/analyze-baseline.count` | dosyadaki sayı |
| biçim borcu | CI "yeni borç yasak" kuralı | dokunduğun dosya temiz çıkar |

`scripts/verify.sh --update-baseline` tavanı yalnızca DÜŞÜRÜR.

## Mimari

- **State:** Riverpod 3 (`flutter_riverpod` + `riverpod_annotation`); ekranlar
  `ConsumerWidget`/`ConsumerStatefulWidget`. Global durum `core/`, ekran durumu feature içinde.
- **Routing:** `go_router`, tek dosya `lib/app/router.dart`; redirect mantığı
  (onboarding → auth → rol) oradadır, ekranda `Navigator.push` yazılmaz.
- **Ağ:** `dio` + `retrofit`; tek `dioProvider` (`core/api/api_client.dart`) token
  yenileme, önbellek ve SSL pinning taşır. Repository katmanı `core/repositories/`;
  ekran doğrudan `Dio` çağırmaz.
- **Modeller:** `freezed` + `json_serializable`, `lib/shared/models/`. `.g.dart` /
  `.freezed.dart` gitignored; build_runner sonrası oluşur.
- **Metinler:** `easy_localization`; her anahtar `assets/l10n/tr.json` VE `en.json`'a
  girer (şu an 401/401, parite testi yok — bir anahtar eklerken ikisine de yaz).
  Widget'ta sabit Türkçe/İngilizce metin yazılmaz.
- **Test:** `test/support/harness.dart` → `pumpApp(tester, widget, device:, textScale:)`
  gerçek tema + l10n + Riverpod ile pump eder. Cihaz matrisi `kDeviceMatrix`.
  Yeni ekran/widget testine üç a11y guideline'ı ekle (`androidTapTargetGuideline`,
  `labeledTapTargetGuideline`, `textContrastGuideline`).
- **Analytics:** ekran açılışı `analyticsServiceProvider.logScreenView('Ad')` (bkz. `home_screen.dart`).

## Web ↔ mobil eşliği

Bir iş kuralı web action'ında ve mobil API ucunda AYRI yazılmaz; gövde
`src/services/`'e girer, iki taşıyıcı çağırır (kök CLAUDE.md). Mobil yanıt gövdesi
`mobile-dto.ts`'ten gelir. Eksik özellik listesi `../docs/web_vs_mobile_comparison.md`
("Fark (Gap)" satırları).

## Cihaz / ortam

- Flutter 3.47.x (CI de 3.47.x), Java 17, Android SDK `/opt/homebrew/share/android-commandlinetools`.
  `ANDROID_HOME` ve `JAVA_HOME` `.claude/settings.json` env'inden gelir; `adb` için
  `scripts/device.sh` kullan (PATH'e bağımlı değildir).
- Gerçek cihaz (Xiaomi, kablosuz adb): `adb shell input` ÇALIŞMAZ (INJECT_EVENTS).
  UI sürmek için integration_test / Dart MCP `flutter_driver`; görsel doğrulama için
  `screencap`. `adb install -r` ve `screencap` çalışır.
- Görsel iş yaptıysan screencap al ve GÖRÜNTÜYE BAK; "düzelttim" demeden önce kanıtla.
- iOS derlemesi CI'da elle tetiklenir (macOS 10x fatura); `mobile/ios/**` değişmedikçe açma.

## Yapma

- `flutter run` / `adb` ile canlı API'ye (bagajpark.com) bağlanma; sadece yerel backend.
- `pubspec.yaml`/`pubspec.lock` sürüm yükseltmesini başka bir işin içine gömme; her
  paket ayrı commit, önce `flutter pub outdated`.
- `analysis_options.yaml`'dan kural silerek uyarı azaltma.
- `build/` altını, ekran görüntüsünü, `key.properties`'i, `google-services.json`'ı commit'leme.
