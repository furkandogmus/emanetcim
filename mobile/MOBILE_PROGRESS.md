# BagajPark Mobil — İyileştirme İlerlemesi

## Son durum — 2026-09-04

**Ortam kuruldu:** Flutter 3.47.2, Android SDK 36, gerçek cihaz (Redmi Note 13 Pro,
kablosuz adb) çalışıyor. Uygulama telefonda kuruluyor ve açılıyor. `flutter analyze`
0 hata, `flutter test` 22 geçiyor.

**Uygulanan düzeltmeler (çalışma ağacında, commit YOK):**
| # | Değişiklik | Dosya | Durum |
|---|---|---|---|
| 1 | intl 0.20.2 → ^0.20.3 (Flutter 3.47 şartı) | pubspec.yaml | applied |
| 2 | AGP 8.9.1 → 8.13.2 (min 8.11.1) | android/settings.gradle.kts | applied |
| 3 | debug cleartext HTTP izni (yerel API için, sadece debug) | android/app/src/debug/AndroidManifest.xml | applied |
| 4 | http_parser doğrudan bağımlılık (4.1.2) — depend_on_referenced_packages | pubspec.yaml | applied |
| 5 | use_build_context_synchronously: State.context guard'ı State.mounted'a çevrildi | booking_detail_screen.dart | applied |
| 6 | deprecated: activeColor→activeThumbColor (4x), Dropdown value→initialValue | profile_screen, booking_detail_screen | applied |
| 7 | a11y: favori butonu 22px→48px dokunma alanı + tooltip etiketi; a11y test ağı | shop_preview_card.dart + yeni test | applied |
| 8 | login yardım metni kesiliyordu → helperMaxLines: 2 (sarabilir) | login_screen.dart | applied — CİHAZDA DOĞRULANDI |
| 9 | a11y: metin kontrastı (WCAG AA) testi eklendi | shop_preview_card_a11y_test | applied |

**Sıradaki iş:** a11y ağını login ekranına genişlet (viewport-bağımsız desen).
NOT: Paket modernizasyonu (öncelik 6) ŞU AN BLOKE — pubspec/lock'a dokunuyor ve
bu, bekleyen Flutter sürüm kararına (3.41 vs 3.47) ve açık PR #13'e bağlı.
Karar çözülene kadar pubspec'e dokunulmayacak.

**Bulgu (Tur 4):** `ShopPreviewCard` genişliğini `MediaQuery.of(context).size.width
* 0.85` ile EKRAN genişliğinden alıyor, ebeveyn kısıtlamasından değil. Gerçek
uygulamada kart tam ekranda kullanıldığı için kullanıcıya yansıyan hata YOK; ama
kart yeniden-kullanılabilir değil (dar bir kapsayıcıda taşar) ve widget-test
viewport'unda güvenilmez taşma üretiyor. Fiat: ya kartı LayoutBuilder/constraints'e
çevir (davranış değişikliği — ayrı karar), ya da golden harness'te MediaQuery.size'ı
tester.view ile doğru ayarla. ŞU AN kullanıcı-etkili değil, düşük öncelik.

**Bloke/beklemede:**
- **PR #13 KIRMIZI + paket modernizasyonu BLOKE:** CI Flutter 3.41.9 kullanıyor,
  `flutter_localizations` intl'i 0.20.2'ye pinliyor; ben (yerel 3.47.2) intl'i
  ^0.20.3 yaptım → CI'da `pub get` version-solving hatası. Karar bekliyor:
  (A) projeyi/CI'ı 3.47'ye taşı, ya da (B) değişiklikleri 3.41'e uyarla. Karar
  gelene kadar pubspec/lock'a dokunulmuyor.
- Cleartext düzeltmesinin canlı doğrulaması → integration_test ile giriş denemesi
  gerekiyor (adb input Xiaomi'de kapalı, integration_test bunu aşar).
- Uyarı sayısı: 48 (başlangıç 56). Test sayısı: 25 (a11y kontrast +1).
- CİHAZ NOTU: ekran uyanıkken screencap sorunsuz; uykudayken programatik
  uyandırma engelli (Xiaomi INJECT_EVENTS). `svc power stayon true` ayarlandı.
  Cihaz-üstü görsel doğrulama için ekranın açık olması yeterli.

## Geçmiş

### 2026-09-05 — Tur 7: a11y kontrast testi (pubspec-güvenli tur)
- **Bağlam:** Sıradaki öncelik paket modernizasyonuydu ama o pubspec'e dokunuyor
  ve bekleyen Flutter-sürüm kararına + PR #13'e bağlı → o alana dokunulmadı.
- **Yapıldı:** ShopPreviewCard a11y test dosyasına `textContrastGuideline` (WCAG AA)
  testi eklendi. Geçti — kartın metin kontrastı yeterli.
- **Kanıt:** 3 a11y testi de yeşil; toplam 24→25; analyze 48 değişmedi.

### 2026-09-05 — Tur 6: login yardım metni kesilmesi
- **Yapıldı:** `login_screen.dart` kimlik alanı `helperText` uzun ("E-posta
  adresinizi veya telefon numaranızı girin") ama `helperMaxLines` varsayılanı 1 →
  kesiliyordu. `helperMaxLines: 2` eklendi, metin artık sarıyor.
- **Kanıt:** analyze 48 (yeni yok), 24 test geçti. Yeniden derlenip cihaza kuruldu.
- **CİHAZDA DOĞRULANDI (ekran uyandıktan sonra):** login screencap'i alındı —
  yardım metni artık iki satıra sarıyor ve tam görünüyor ("...numaranızı girin"),
  eskiden "...numaranızı g..." diye kesiliyordu. Görsel teyit tamam.

### 2026-09-05 — Tur 5: a11y test ağı gerçek bug yakaladı ve düzeltti
- **Bulundu:** ShopPreviewCard favori (kalp) butonu `GestureDetector`+`Icon(size:22)`
  idi → dokunma hedefi 22x22 (min 48), üstelik etiketsiz. androidTapTargetGuideline
  + labeledTapTargetGuideline testleri KIRMIZI verdi (gerçek, viewport'tan bağımsız).
- **Düzeltildi:** `IconButton`'a çevrildi — 48x48 constraints, iconSize 22 (görsel
  aynı), tooltip `shop.favorite`/`shop.unfavorite` (ekran okuyucu etiketi). 
- **Kanıt:** iki a11y testi de yeşil; suite 22→24; analyze 48 (yeni uyarı yok).
- **Not:** Bu, kullanıcı-etkili gerçek bir erişilebilirlik düzeltmesi (küçük/etiketsiz
  favori butonu). Test ağı artık bunu koruyor.

### 2026-09-05 — Tur 4: cihaz-matrisi testi denendi → gerçek bulgu, düzeltme yok
- **Denendi:** ShopPreviewCard için 3 boyut x 2 yazı ölçeği taşma testi.
- **Sonuç:** Test taşma raporladı ama miktarlar mantıksızdı (334px kartta 699px).
  Diagnostik: kart genişliğini MediaQuery.size'dan alıyor, parent constraint'ten
  değil → viewport harness güvenilmez. Gerçek uygulamada (tam ekran) sorun değil.
- **Karar (loop kuralı: emin olmadan "düzelttim" deme):** flaky test GERİ ALINDI,
  bulgu yukarıya kaydedildi. Suite yeşil kaldı (22 test), analyze 48. Yanlış iddia yok.

### 2026-09-04 — Tur 3: deprecated API'ler temizlendi
- **Yapıldı:** Switch `activeColor`→`activeThumbColor` (profile_screen, 4 yer,
  Flutter 3.31'de deprecate); `DropdownButtonFormField` `value:`→`initialValue:`
  (booking_detail_screen:719, 3.33'te deprecate). DropdownMenuItem value'ları
  (deprecate DEĞİL) korundu.
- **Kanıt:** deprecated_member_use uyarısı sıfırlandı; toplam 53→48. Test 22 geçti.

### 2026-09-04 — Tur 2: use_build_context_synchronously çökme riski
- **Yapıldı:** `_modifyBooking` bottom-sheet'inde tarih/saat seçici `onTap`'lerinde,
  `await showDatePicker` sonrası `showTimePicker(context: context)` State.context
  kullanıyordu ama guard `if (!context.mounted)` idi — lint "unrelated" diyordu.
  Guard State'in kendi `mounted`'ına (`if (!mounted)`) çevrildi (553, 568).
- **Kanıt:** dosyada use_build_context uyarısı kalktı; toplam 55→53. Test 22 geçti.

### 2026-09-04 — Tur 1: http_parser bağımlılığı
- **Yapıldı:** `profile_screen.dart` `MediaType.parse` için http_parser kullanıyor ama
  pubspec'te yoktu (dio üzerinden dolaylı geliyordu). pubspec.lock'taki çözülmüş sürüm
  4.1.2 doğrudan bağımlılık olarak eklendi.
- **Kanıt:** `flutter analyze` http_parser uyarısı kalktı (56→55). `flutter test` 22 geçti.
- **Not:** Test loglarındaki "Localization key search.day_unit not found" uyarısı GERÇEK
  HATA DEĞİL — anahtarlar tr.json/en.json içinde search altında mevcut (satır 129/142).
  Uyarı test ortamında easy_localization yüklenmemesinden. Bu yüzden dokunulmadı.
