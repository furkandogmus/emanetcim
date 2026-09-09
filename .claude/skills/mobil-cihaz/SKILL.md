---
name: mobil-cihaz
description: Gerçek Android cihazda (kablosuz adb) uygulamayı kur, çalıştır, ekran görüntüsü al ve görsel olarak doğrula. UI değişikliği, taşma/kesilme/kontrast şüphesi veya crash incelemesinde kullan.
---

# Gerçek cihazda doğrulama

Tüm işler `mobile/scripts/device.sh` üzerinden; adb PATH'te olmasa da çalışır, cihaz ve
yerel API adresini `mobile/.device.env`'den okur (gitignored; şablon
`scripts/device.env.example`). Canlı API'ye bağlanmayı script kendisi reddeder.

```bash
cd mobile
scripts/device.sh --status       # bağlı mı, ekran uyanık mı
scripts/device.sh --connect      # koptuysa; port değiştiyse kullanıcıdan yeni portu iste
scripts/device.sh --install      # yerel API ile debug APK derle + adb install -r
scripts/device.sh --run          # flutter run (hot reload); sadece Dart değiştiyse install gerekmez
scripts/device.sh --screencap    # build/screenshots/<UTC>.png yolunu basar
scripts/device.sh --logcat       # crash / flutter satırları
```

## Görsel doğrulama akışı

1. Değişikliği yap, `--run` açıksa `r` ile hot reload; değilse `--install`.
2. Ekranın AÇIK olduğundan emin ol (`--status` → `mWakefulness=Awake`). Uyuyorsa
   kullanıcıdan telefonu uyandırmasını iste; Xiaomi'de programatik uyandırma yok.
3. `--screencap` ile görüntü al, çıkan PNG'yi **Read ile aç ve gerçekten bak**:
   taşma (sarı-siyah şerit), kesilen metin ("..."), kontrast, dokunma hedefi boyutu.
4. Raporda gördüğünü yaz ("yardım metni iki satıra sarıyor, tam görünüyor"), tahmin değil.

## Cihaz kısıtları (Xiaomi, Android 15)

- `adb shell input tap/text` ÇALIŞMAZ (INJECT_EVENTS izni yok). Ekranı sürmek için
  Dart MCP sunucusunun `flutter_driver` araçlarını ya da `integration_test` kullan;
  kullanıcıdan "şu butona bas" istemek de kabul edilebilir.
- `adb install -r`, `screencap`, `logcat` çalışır.
- Ekran görüntüleri `build/` altında, git'e girmez. Repoya PNG ekleme.
