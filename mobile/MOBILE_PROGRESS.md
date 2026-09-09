# BagajPark Mobil — İyileştirme İlerlemesi

## Son durum — 2026-09-05

**Ortam:** Flutter 3.47.2 yerelde VE CI'da (mobile-ci.yml 3.47.x, commit 716ed2b).
Sürüm kararı (A) ile çözüldü; **paket modernizasyonu artık bloke değil.** Gerçek
cihaz (Redmi Note 13 Pro, kablosuz adb) çalışıyor; "Uyanık kal" geliştirici
seçeneği açık (`stay_on_while_plugged_in=15`), screencap için ekran uyandırma gerekmiyor.

**Commit durumu:** Tur 1-8 çıktıları kullanıcı isteğiyle 2026-09-05'te dört commit
olarak `mobil-kalite-duzeltmeleri` dalına atıldı ve push'landı (e36e518, c25d80b,
716ed2b, 4bec971). PR #13 CI'da `pub get` artık geçiyor; Build Android koşuyor.
Tur 9-10 çıktıları **çalışma ağacında, commit YOK** (loop kuralı).

**Çalışma ağacındaki değişiklik seti (Tur 9-10):**
| # | Değişiklik | Dosya | Durum |
|---|---|---|---|
| 10 | Outfit fontları (Regular/Medium/SemiBold/Bold) paketlendi; google_fonts önce asset'e bakar, ilk açılışta ağa çıkmaz | assets/fonts/*.ttf, pubspec.yaml (assets) | applied — CİHAZDA DOĞRULANDI |
| 11 | Testte `GoogleFonts.config.allowRuntimeFetching=false`: font ağ çağrısı mock HttpClient'a çarpıp yakalanmamış hata üretiyordu | test/flutter_test_config.dart | applied |
| 12 | a11y: "Kayıt Ol" dokunma hedefi 72x21 → 48 (shrinkWrap/Size.zero kaldırıldı), satır Row→Wrap (büyük yazı ölçeğinde taşmaz) | login_screen.dart | applied — CİHAZDA DOĞRULANDI |
| 13 | a11y: şifre göster/gizle butonuna tooltip (ekran okuyucu etiketi), `auth.show_password`/`hide_password` tr+en | login_screen.dart, l10n | applied |
| 14 | a11y: sabit Türkçe `Semantics(label:'Giriş Yap'/'Nasıl Çalışır?')` kaldırıldı — İngilizce arayüzde ekran okuyucu Türkçe okuyordu; buton metni zaten etiket | login_screen.dart | applied |
| 15 | Login a11y testi (3 test: gerçek çeviri, tap target, etiket) | test/features/auth/login_screen_a11y_test.dart | applied |
| 16 | Sabit Türkçe 'Hesap Seçin' / 'Biyometrik Giriş (N)' → `auth.select_account`, `auth.biometric_multi` (tr+en, 405/405 parite) | login_screen.dart, l10n | applied (Tur 10) |

**Sayılar:** analyze 48 (tavan 48). Test 30 geçti, 1 atlandı. Biçim: yeni borç yok
(login_screen.dart eski borçluydu; dosya tamamen biçimlendi, diff bu yüzden büyük).

**Sıradaki iş:** Paket modernizasyonu (öncelik 6), sırayla, her biri ayrı tur:
flutter_secure_storage 10→11 ilk. ÖNCE Tur 9-10 commit'lenmeli: pubspec.yaml'da
Tur 9'un asset değişikliği duruyor, paket yükseltmesi aynı diff'e karışmamalı
(mobile/CLAUDE.md: her paket ayrı commit). Commit kararı kullanıcının. `/mobil-paket` akışı: changelog oku, breaking
change tara, kapı, ayrı commit'e hazır bırak.

**Bilinen ama dokunulmayan:**
- `textContrastGuideline` login ekranında BİLEREK yok: algoritma düğüm
  dikdörtgenindeki pikselleri ortalama açıklığa göre bölüp her gruptan en sık rengi
  alıyor; dekoratif soluk turuncu daire "koyu" gruba düşünce beyazla 1.2 çıkıyor,
  metin rengi hiç ölçülmüyor. Düz zeminli widget'larda (kart) geçerli, dekorlu tam
  ekranlarda değil. (flutter_test accessibility.dart `_ContrastReport`)
- `ShopPreviewCard` genişliğini ekrandan alıyor (Tur 4 bulgusu), düşük öncelik.
- Cleartext düzeltmesinin canlı doğrulaması → integration_test ile giriş; yerel
  backend'in ayakta olması gerekir.

## Geçmiş

### 2026-09-05 — Tur 10: login'deki son sabit Türkçe metinler çeviriye taşındı
- **Yapıldı:** biyometrik hesap seçicideki 'Hesap Seçin' ve 'Biyometrik Giriş (N)'
  `auth.select_account` / `auth.biometric_multi` (`{}` argümanlı) oldu; tr ve en'e
  eklendi. Dosyada sabit Türkçe metin kalmadı (grep ile doğrulandı).
- **Kanıt:** tr/en anahtar paritesi 405/405, fark yok. Kapı yeşil: analyze 48, test
  +30 ~1, biçim yeni borç yok. Görsel etki yok (yalnızca biyometrik hesap varken
  görünen metin; cihazda biyometrik hesap kayıtlı değil, screencap alınmadı).
### 2026-09-05 — Tur 9: login a11y ağı → 3 gerçek düzeltme + fontlar paketlendi
- **Test yazıldı:** harness ile login ekranı (tokenStoreProvider fake: biyometrik hesap yok).
- **İlk koşuda iki sahte, üç gerçek bulgu:**
  - SAHTE: "Hesabınız yok mu? Kayıt Ol" satırı 32px taşıyordu → test fontu (her glif
    kare) yüzünden; gerçek Outfit yüklenince kayboldu. Yine de Row→Wrap yapıldı.
  - SAHTE: kontrast 1.2 → dekoratif daire artefaktı (yukarıda). Test bilerek dışarıda.
  - GERÇEK: google_fonts testte ağa çıkıyor, mock HttpClient'ta `Null is not a subtype
    of Future<HttpClientRequest>` ile yakalanmamış hata. Çözüm: fontlar asset olarak
    paketlendi (google_fonts'un beklediği hash'lerle birebir, fonts.gstatic'ten indirildi)
    + `allowRuntimeFetching=false`. Yan kazanım: uygulama ilk açılışta font için ağa çıkmıyor.
  - GERÇEK: "Kayıt Ol" dokunma hedefi 72x21 (androidTapTargetGuideline).
  - GERÇEK: şifre göster/gizle IconButton etiketsiz (labeledTapTargetGuideline).
- **Kanıt:** login testi +3 yeşil; kapı `verify-20260904T224122Z.log` → analyze 48,
  test +30 ~1, biçim yeni borç yok. Cihaza kuruldu, login screencap'i alındı ve BAKILDI:
  kayıt satırı doğal boşlukla, font Outfit, göz ikonu yerinde.

### 2026-09-05 — Tur 8: gerçek çeviri yükleyen test harness'i (önceki oturum, buraya sonradan yazıldı)
- **Yapıldı:** `test/support/harness.dart` (`pumpApp`: gerçek tema + l10n + Riverpod +
  ağ görseli mock + cihaz profili + yazı ölçeği), `test/flutter_test_config.dart`
  (EasyLocalization/SharedPreferences hazırlığı), kanıt testi.
- **Bulundu ve düzeltildi:** aynı dosyadaki ikinci test ham anahtar görüyordu — çeviri
  dosyası gerçek asset I/O ile geliyor, `pumpAndSettle` beklemiyor. `pumpWidget`
  `tester.runAsync` altına alındı.
- **Kanıt:** kapı yeşil (+27 ~1), sonra commit c25d80b.


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
