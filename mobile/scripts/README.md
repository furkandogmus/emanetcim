# mobile/scripts — agent ve geliştirici yardımcıları

| Script | Ne yapar | Değiştirir mi |
|---|---|---|
| `verify.sh` | `flutter analyze --no-fatal-infos` + mandal, `flutter test`, değişen dosyalarda `dart format` (CI ile aynı kurallar). Log: `logs/verify-<UTC>.log` | Hayır (`--update-baseline` yalnızca `analyze-baseline.count`'u düşürür) |
| `device.sh` | Kablosuz adb cihaz: `--status`, `--connect`, `--screencap`, `--logcat`, `--install`, `--run` | `--install`/`--run` cihaza kurar; canlı API'yi reddeder |
| `analyze-baseline.count` | Analyze issue tavanı (mandal). Sayı düşebilir, yükselemez | — |
| `device.env.example` | `../.device.env` şablonu (ADB_DEVICE, API_BASE_URL); gerçek dosya gitignored | — |

Kurulum (bir kez): `cp scripts/device.env.example .device.env` ve LAN adreslerini yaz.

Claude Code tarafı: `.claude/settings.json` hook'ları `.dart` düzenlemesini otomatik
biçimler ve define'sız / canlı-API'li `flutter run`'ı engeller; skill'ler
`/mobil-dogrula`, `/mobil-cihaz`, `/mobil-ekran`, `/mobil-api-ucu`, `/mobil-paket`, `/commit`.
