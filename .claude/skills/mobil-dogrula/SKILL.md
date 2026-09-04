---
name: mobil-dogrula
description: Flutter mobil değişikliğini CI ile aynı kapıdan geçir (analyze + test + biçim + mandal). Her mobil değişiklikten sonra, "bitti" demeden önce kullan.
---

# Mobil doğrulama kapısı

`mobile/` altında bir şey değiştirdiysen işi bitmiş sayma, önce bunu çalıştır:

```bash
cd mobile && scripts/verify.sh
```

Hızlı tur (test atlanır, ~10 sn): `scripts/verify.sh --skip-test`
Üretilmiş dosya eksikse (`.g.dart`/`.freezed.dart`): `scripts/verify.sh --gen`

## Sonucu nasıl okuyacaksın

- `KAPI YESIL` → raporla: analyze sayısı, test özeti (`+N` geçti), biçim durumu.
- `MANDAL: analyze N issue, tavan M` → yeni uyarı EKLEDİN. Kendi diff'indeki uyarıyı
  kaldır; tavanı yükseltmek yasak, `analysis_options.yaml`'dan kural silmek yasak.
- `flutter test KIRMIZI` → çıktıda `Failing tests:` altındaki dosyayı oku, düzelt, tekrar
  çalıştır. Testi silmek ya da `skip:` eklemek çözüm değildir.
- `bicim disi ve ONCEDEN TEMIZDI` → `dart format <dosya>` çalıştır. Eski borçlu dosyalar
  atlanır, onları biçimlemek zorunda değilsin (CI ile aynı kural).
- Uyarı sayısını düşürdüysen `scripts/verify.sh --update-baseline` ile tavanı indir ve
  `scripts/analyze-baseline.count` dosyasını değişikliğe dahil et.

## Raporlama

Yapılmamış işi yapılmış gibi yazma. Kanıt olmadan "düzelttim" deme; kanıt = bu scriptin
çıktısı (log: `mobile/scripts/logs/verify-<UTC>.log`) ve görsel işse cihaz ekran görüntüsü
(`/mobil-cihaz`).
