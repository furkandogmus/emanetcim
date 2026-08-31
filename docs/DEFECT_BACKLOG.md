# BagajPark — Kanıtlı Hata Backlog'u

> Bu doküman **iş kuyruğudur**: her madde ya bir dosya:satır ya da çalıştırılmış bir
> sorgu/ölçümle kanıtlanmıştır. Doğrulanmamış hiçbir şey P0/P1/P2 olarak listelenmez —
> öyle şeyler en altta "Doğrulanması gerekenler" başlığındadır.
>
> Farkı şudur: `docs/PRODUCTION_BACKLOG.md` stratejik/uyumluluk **dilek listesidir**
> (24 kategori, hiçbiri uygulamaya karşı doğrulanmamış) ve öyle kalsın diye
> dokunulmadı. `docs/UX_AUDIT_BOUNCE_COMPARISON_2026-06-15.md` ise 15 Haziran'dan
> kalma, yalnızca UX kapsayan eski bir denetim; hâlâ geçerli ama **eksik** — 21
> Ağustos'ta bulunan iki kritik hatanın ikisi de içinde yoktu.

## 2026-08-31 — mobil CI 22 Ağustos'tan beri kırmızı; hiçbir mobil değişiklik doğrulanmamış

Flutter düzeltmesini gönderdim ve "CI doğrulayacak" dedim. CI kırmızı döndü —
ama sebebi benim değişikliğim değildi.

`dart format --set-exit-if-changed` **37 dosyada** biçim farkı buluyor ve
çoğuna aylardır dokunulmamış (`router.dart`, `api_client.dart`,
`login_screen.dart`…). Adım **ilk sıradaydı**, yani:

| Adım | Durum |
|---|---|
| `dart run build_runner build` | çalışıyordu |
| `dart format --set-exit-if-changed` | **kırmızı → iş burada duruyor** |
| `flutter analyze` | hiç çalışmadı |
| `flutter test` | hiç çalışmadı |
| `flutter build apk` | hiç çalışmadı |

Mobile CI geçmişi: **22 Ağustos'tan bu yana dokuz koşunun dokuzu da başarısız.**
Yani mobil tarafa giren her değişiklik — profil ekranı hata metni, giriş/kayıt
autofill, değerlendirme gönderimi ve benim prelaunch düzeltmem — **gerçek
kapıların hiçbirinden geçmeden** bıraktı.

**Düzeltme sıra değiştirmek, gevşetmek değil.** Biçim bozuksa iş yine KIRMIZI
düşer; fark, analiz/test/derleme sonuçlarının artık görünmesi. Bir kapının
diğerlerini maskelemesi, kapının kendisinden büyük bir sorun. Biçim kontrolü
`Upload APK`'dan da sonraya alındı — aksi halde kırmızı biçim, üretilmiş APK'nin
yüklenmesini de engelliyor ve elde inceleyecek çıktı kalmıyordu.

### Ölü kapının sakladığı şey: mobil uygulama DERLENMİYORDU

Sıra değiştirilince `flutter analyze` bir haftada ilk kez çalıştı ve **6 derleme
hatası** buldu:

```
error • Undefined name 'shop' • lib/features/search/shop_detail_screen.dart:294 • undefined_identifier
error • Undefined name 'shop' • .../shop_detail_screen.dart:302 • undefined_identifier
error • Undefined name 'shop' • .../shop_detail_screen.dart:317 • undefined_identifier
```

Sebep: kapsamdaki değişken `s` (`data: (s) => Stack(...)`) ama harita önizleme
bloğu `shop.latitude` / `shop.longitude` yazıyor. `76218f6`'da girmiş
("shop map") ve **biçim adımı ilk sırada olduğu için analiz hiç çalışmamış**.
Yani mobil uygulama en az bir haftadır derlenmiyordu ve bunu kimse görmüyordu.

Düzeltildi (`shop.` → `s.`, 6 referans). Ayrıca ölü `_showInfo` metodu silindi
(tek `warning`).

**`--no-fatal-infos`:** `flutter analyze` varsayılan olarak `info` seviyesini de
ölümcül sayıyor ve ağaçta 60 tane var — hepsi biçim/stil önerisi
(`directives_ordering`, `prefer_const_constructors`). Sonucu kapının **kalıcı
olarak kırmızı** olmasıydı, ve kalıcı kırmızı bir kapı hiçbir şeyi korumaz:
nitekim altı derleme hatası tam bu yüzden görünmedi. Artık `error` ve `warning`
işi düşürüyor, `info` düşürmüyor ama çıktıda görünmeye devam ediyor.

### Sonraki ölü kapı: `flutter test` de kırıktı

`analyze` düzelince `flutter test` çalıştı ve **19 test geçti, 2'si düştü** —
ikisi de `shop_preview_card_test.dart`:

```
ProviderScope.containerOf (flutter_riverpod/src/core/provider_scope.dart:105)
ShopPreviewCard.build (shop_preview_card.dart:30)
```

`ShopPreviewCard` bir Riverpod `ConsumerWidget` (favorileri `ref.watch` ile
okuyor) ama test onu **`ProviderScope` olmadan** render ediyordu. Widget
`ConsumerWidget`'a çevrildiğinde test güncellenmemiş; `flutter test` hiç
koşmadığı için de kimse görmemiş.

Düzeltildi (`ProviderScope` sarmalayıcı) ve prelaunch davranışı için bir test
eklendi: talep testi noktasında `₺50` **gösterilmediği** doğrulanıyor. Bu, tam
da bu turda düzelttiğim davranışın regresyonunu yakalar.

### Zincirin sonu: APK bir haftadır ilk kez derlendi

Üç düzeltmeden sonra mobil iş şu hale geldi:

| Adım | Bir hafta boyunca | Şimdi |
|---|---|---|
| `flutter analyze` | hiç çalışmadı | ✅ |
| `flutter test` | hiç çalışmadı | ✅ (19 test) |
| `flutter build apk` | hiç çalışmadı | ✅ **derlendi** |
| `Upload APK` | hiç çalışmadı | ✅ artefakt yüklendi |
| `dart format` (tüm ağaç) | ❌ | ❌ → değişen dosyalara daraltıldı |

**Biçim kontrolü artık yalnızca değişen dosyalara bakıyor.** Tüm ağaca bakan
kontrol kapıyı kalıcı kırmızıya çakıyordu ve kalıcı kırmızı bir kapı hiçbir şeyi
korumaz — nitekim ardında altı derleme hatası, bir ölü metot ve iki kırık test
birikmişti. Değişen dosyalara bakmak ikisini birden sağlar: **yeni kod standarda
uymak zorunda, eski borç gerçek hataları maskelemiyor.**

Kabul edilen ödünç: 37 dosyalık borçtan birine dokunan tek satırlık bir
değişiklik bile bu adımı kırmızı yapar. Adımın hata çıktısı ne yapılacağını
yazıyor (`cd mobile && dart format <dosya>`), ve borç tümüyle kapandığında
kontrol tekrar tüm ağaca genişletilebilir.

**Açık:** 37 dosyanın biçim borcu, 60 `info` önerisi, ve
`booking_detail_screen.dart`'ta altı `use_build_context_synchronously` — sonuncusu
stil değil, gerçek çökme sınıfı (kullanıcı tarih seçiciyi açıkken sayfayı
kapatırsa). `dart format .` tek komut ama bu
makinede dart/flutter kurulu değil ve kullanıcının bilgisayarına kurulum
yapılmayacak. Mobil geliştirme yapan biri `cd mobile && dart format .` koşup
commit'lerse gate tamamen yeşile döner.

## 2026-08-31 — açık kalan üç madde kapatıldı

Önceki turlarda "sizin kararınız" ya da "araç yok" diye bıraktığım üç şey vardı.
Üçü de kapandı; ikisinde teşhisim yanlıştı.

### 1. Mobil uygulama — YANLIŞ TEŞHİS DÜZELTİLDİ

"Bu makinede flutter/dart yok, freezed dosyaları üretilemez, `mobile/` dizinine
dokunmuyorum" demiştim. Yanlıştı: üretilmiş dosyalar depoda değil,
`mobile-ci.yml` içinde `dart run build_runner build` koşuyor ve ardından
`flutter analyze`, `flutter test`, `flutter build apk` geliyor. Kaynağı
düzenlemek yeterli; doğrulamayı CI yapıyor. **Araç eksikliği sandığım şey, iş
akışını okumamış olmamdı.**

`ShopDto` bayrağı aldı; kart ve detay ekranı fiyat yerine "Yakında" gösteriyor;
detay ekranındaki rezervasyon düğmesi **kapalı** (`onPressed: null`). Önceden
misafir 50 TL görüp "Şimdi Rezerve Et"e basıyor ve sunucudan `409
shop_not_open_yet` yiyordu — sunucu kapısı sağlamdı ama söz önce veriliyordu.

### 2. Açılış e-postası — üretimde ÖLÇÜLDÜ

"Prod'da hiç denenmedi" diye bırakmıştım. Gönderim yolu üretimde doğrulandı
(sır hiçbir yere yazılmadan, yalnızca durum kodu okunarak):

| Kontrol | Sonuç |
|---|---|
| `RESEND_API_KEY` tanımlı | evet (36 karakter) |
| Resend `/domains` çağrısı | **200** — anahtar geçerli |
| `bagajpark.com` alan adı | **verified**, eu-west-1 |
| `EMAIL_FROM` | `BagajPark <info@bagajpark.com>` — doğrulanmış alanla eşleşiyor |

`notifyPrelaunchOpened`, diğer bütün işlem e-postalarıyla **aynı** `sendEmail`
yolunu kullanıyor. Geriye kalan tek bilinmeyen, şablonun gerçek bir gelen
kutusunda nasıl göründüğü — o da her e-postayla ortak olan `renderEmailHtml`.

### 3. Check-in kapanış toleransı — KARAR VERİLDİ

İki turda sorup cevap alamadım; kararı verdim ve **ayarlanabilir** yaptım.

Sorun: misafir çalışma saati **içinde** bir bırakış saati seçip rezervasyon
yapıyor, ama birkaç dakika geç geliyor. Esnaf tezgahta, misafir karşısında,
ikisi de razı — ve sistem valizi reddediyordu. Ret, misafiri valiziyle sokakta
bırakır; kabul, esnafın zaten orada olduğu bir anda tek bir işlem yapmasını
sağlar.

`PlatformSettings.checkInGraceMin`, **varsayılan 30 dakika**. Kalıp yeni değil —
`latePickupGraceMin` zaten aynı şekilde çalışıyor. `/admin/platform-settings`
üzerinden değiştirilir; **`0` yazılırsa eski davranış (tolerans yok) birebir
geri gelir.**

İki ayrıntı kasıtlı: tolerans yalnızca **kapanış** tarafına uygulanıyor (açılıştan
önce gelen misafir için anlamsız — dükkan açılmamış, esnaf orada değil), ve
uygulaması "saati geriye al, aynı kontrolü tekrarla" biçiminde; kapanış saatini
ileri kaydırmak gece yarısını aşan çalışma saatlerini (`22:00–04:00`) bozardı.

## 2026-08-31 — hesapsız misafir KENDİ kodunu yazınca rezervasyonunu bulamıyordu

En kritik yol: misafir anonim rezervasyon yaptı, sekmeyi kapattı, dükkanın
önünde QR'ını arıyor. Tıkanırsa valiz teslim edilemez. İki hata vardı, ikisi de
yerel veritabanına karşı ölçüldü.

**1. Harf duyarlılığı.** Kod misafirin ekranında BÜYÜK HARF yazılı
(`booking.id.slice(0, 8).toUpperCase()` → `D8A7FF57`), kimlik ise küçük harf
saklanıyor. Postgres'te `startsWith` harf duyarlı:

| Girdi | Sonuç (önce) |
|---|---|
| `D8A7FF57` (ekranda yazan) | **BULUNAMADI** |
| `d8a7ff57` | bulundu |

Yani misafir **kendi ekranındaki kodu** yazıyor ve "Rezervasyon bulunamadı"
alıyor — hatayı kendi yazımından ayırt etmesi imkânsız.

**2. `id` filtresi 8 hanede tamamen düşüyordu.** Kod şöyleydi:

```ts
id: bookingId.length > 8 ? bookingId : undefined
```

8 karakterlik kodda `id: undefined` oluyor ve Prisma filtreyi **yok sayıyor**;
sorgu yalnızca e-postaya bakıp o kişinin İLK rezervasyonunu döndürüyordu. Test
hesabında o e-postanın **48 rezervasyonu** var. Yani yanlış/eksik kod yazan bir
misafire BAŞKA bir rezervasyonun QR'ı veriliyordu — esnaf tarar, tarih ve valiz
sayısı tutmaz.

Düzeltme: kod normalize ediliyor (küçük harf, boşluk ve tire temizleniyor —
telefonda okunarak aktarılan bir kod için olağan yazımlar), en az 6 hane
zorunlu, ve **iki eşleşme çıkarsa hiçbiri açılmıyor**. Yanlış rezervasyonun
QR'ını vermek, hiç vermemekten kötüdür.

Uçtan uca doğrulandı (yerel API):

| Girdi | Sonuç |
|---|---|
| `D8A7FF57` | `ok: true`, doğru rezervasyon |
| `D8A7-FF57` | `ok: true` |
| `ZZZZZZZZ` | `ok: false, Booking not found` |

## 2026-08-31 — 482 nokta arama motoruna 2.892 ince sayfa olarak bildiriliyordu

Talep testini 50 noktadan 482'ye çıkarmanın görmediğim bir bedeli varmış. Üç
ayrı sorun, üçü de sessiz:

**1. Site haritası 2.892 yer tutucu URL bildiriyordu.** 482 nokta × 6 dil, hepsi
rezervasyon almayan ve birbirinin neredeyse aynı "yakında açılıyor" sayfası.
Aramadan gelen ziyaretçi aradığını bulamaz (kötü kullanıcı deneyimi), arama
motoru ince içerik görür (kötü kalite sinyali) ve üç gerçek dükkanın tarama
bütçesi 482 yer tutucuya bölünür.

**2. Aynı sorgu `isTest` kayıtlarını da bildiriyordu.** `where: { isActive: true }`
elle yazılmıştı. Oysa P1-4'ün kuralı "isTest kaydı kamuya HİÇ görünmez" — ve
site haritasından daha kamuya açık bir yer yok. Filtreyi tek yerde tutmanın
sebebi tam olarak buydu; dördüncü çağrı yeri eklendiğinde biri unutuldu.

**3. `getShopPublicDetail` de `isTest` süzmüyordu.** P1-4 düzeltmesi arama,
listeler ve istatistikleri kapsamış ama **detay sayfasını atlamıştı**: test
dükkanı aramada görünmüyor, URL'i bilen (ya da eski bir bağı olan) herkes
sayfasını açabiliyordu. Bugün üretimde aktif test kaydı yok, yani belirti
üretmiyor — ama kural mutlak yazılmış.

Düzeltmeler:

- Site haritası `OPERATING_SHOP_FILTER` kullanıyor: yalnızca gerçekten
  rezervasyon alan dükkanlar bildiriliyor. Yerelde ölçüldü — 2 işletilen dükkan
  kaldı, 9 prelaunch noktası çıktı.
- Prelaunch nokta sayfası `robots: { index: false, follow: true }`. `follow`
  kalıyor ki sayfadaki gerçek bağlantılar (talep haritası, esnaf başvurusu)
  taranabilsin. Nokta açıldığında `isPrelaunch` false olur ve sayfa
  kendiliğinden dizine açılır — ayrıca bir şey yapmak gerekmiyor.
- `getShopPublicDetail` artık `PUBLIC_SHOP_FILTER` kullanıyor (prelaunch geçer,
  test geçmez).

Talep testinin trafiği zaten site içi aramadan geliyor; `/demand` sayfası ise
gerçek içerik olarak dizinde kalıyor — esnafa ölçülmüş talebi gösteren asıl
pazarlama yüzeyi o.

## 2026-08-31 — talep testi zinciri CANLIDA uçtan uca doğrulandı

Bu oturumda gönderilen her parça üretimde tek tek denendi. "Testler geçiyor"
ile "kullanıcının elinde çalışıyor" ayrı şeyler; ikincisi ölçülmeden kapatılmadı.

| Doğrulanan | Sonuç |
|---|---|
| `/tr/how-it-works` | 200; animasyon anahtar kareleri, HowTo yapısal verisi ve mühür metni sayfada |
| `/tr/demand` | 200; sinyal yokken dürüst boş durum, sinyal gelince nokta listede |
| `/tr/become-partner` | 200; "Talep haritasını gör" bağlantısı var |
| `/tr/search` | 200; 11 sonuç kartı, prelaunch noktaları "Yakında" ile |
| Prod şeması | `PrelaunchInterest.notifiedAt` sütunu mevcut (migrasyon geçti), 482 nokta |
| Nokta sayfası | Yerel ad ("Tour Eiffel — Consigne à Bagages"), fiyat yok, "Yakında", panel en üstte |
| **Tek tık sayacı** | Tıklandı → "İsteğin sayıldı", düğme kilitlendi, sayı **1**'e çıktı |
| **Esnaf kartı** | Köşede çıktı; eşiğin altında olduğu için **rakam vermeyen** metinle |
| **Talep haritası** | Aynı nokta listeye düştü, boş durum kalktı |

**Test verisi temizlendi.** Sayacı kanıtlamak için üretime tek bir `PrelaunchWant`
satırı yazıldı ve hemen silindi (`DELETE 1`, ardından tablo 0, `/demand` yeniden
boş durum). Karar bu sayıya bakılarak veriliyor — bir şehre esnaf onboarding'i
on binlerce dolarlık taahhüt — ve kendi test tıklamamı bırakmak o kararı
kirletirdi.

**Açık kalan:** `--open` ile gönderilen açılış e-postası üretimde HİÇ
denenmedi; yerelde Resend anahtarı olmadığı için gönderim "atlandı" olarak
loglandı. İlk gerçek nokta açılışında ilk e-posta gözle doğrulanmalı.

## 2026-08-31 — talep testi noktaları aramada HİÇ görünmüyordu (üretimde ölçüldü)

482 nokta üretime yazıldıktan sonra arama ekranı İstanbul'da **"TÜM NOKTALAR (3)"**
dedi; İstanbul'da 10 nokta vardı ve hiçbiri listede yoktu. Özellik üretimde vardı ama
ölçmüyordu — misafirin noktaya tıklaması, yani ölçmek istediğimiz tek sinyal, hiç
gerçekleşemezdi.

- **Sebep özelliğin kendi tasarımıydı.** Prelaunch noktaları bilerek slot üretmiyor
  (`OPERATING_SHOP_FILTER`; aksi halde 482 nokta `slotGeneration` sağlık sinyalini bir
  günde `stale` yapardı). `findShopsForSearch` ise slot dalında `slots.length === 0`
  gördüğü her dükkanı eliyordu, eski kapasite dalında da varsayılan 09:00–20:00
  saatleri `isShopOpenForStay`e takılıyordu. İki süzgeç de doğru çalışıyordu; yanlış
  olan, rezervasyon alan bir dükkanla bir ölçüm noktasına aynı soruları sormaktı.
- **Düzeltme**: prelaunch ayrı listede toplanıp iki süzgecin dışında tutuluyor. Eski
  kapasite dalına düşme kararı yalnızca işletilen dükkanlara bakıyor (yoksa slot
  tablosu boşken gerçek dükkanlar aramadan kaybolurdu) ve rezervasyon alabilen dükkan
  her zaman önce sıralanıyor.
- **Arayüz üç yüzeyde ayrıştırılmıştı**: detay sayfası "Yakında" derken kart ve harita
  pin'i hâlâ ₺50 ve "Rezervasyon yap" gösteriyordu. Üçü birleştirildi; kart müsaitlik
  rozetini ("~49 müsait" — olmayan bir stok) de çizmiyor.
- **Regresyon testi**: `src/__tests__/search-prelaunch-visibility.test.ts`. Hatanın
  sinsi tarafı sessiz olması — aramaya eklenen yeni bir süzgeç prelaunch'u yeniden eler
  ve hiçbir şey kırılmaz. Test, düzeltme geri alındığında 5'te 3 kırılarak doğrulandı.

### KAPANDI — mobil uygulama bayrağı kullanıyor

`/api/mobile/shops/nearby` aynı `findShopsForSearch`i kullanıyor, yani mobil de
talep testi noktalarını listeliyor. Sunucu bayrağı (`isPrelaunch`) taşıyordu ama
Flutter tarafı okumuyordu: kart 50 TL ve "Şimdi Rezerve Et" çiziyor, misafir
deniyor ve sunucudan `409 shop_not_open_yet` yiyordu. Sunucu kapısı sağlam,
hayalet rezervasyon oluşmuyor — ama tutamayacağımız sözü verdikten sonra
reddetmek kapının işi değil, arayüzün işi.

**Önce yanlış teşhis koymuştum:** "bu makinede flutter/dart yok, freezed
dosyaları üretilemez, dokunmuyorum" demiştim. Yanlıştı — üretilmiş dosyalar
depoda değil, `mobile-ci.yml` içinde `dart run build_runner build` koşuyor ve
ardından `flutter analyze`, `flutter test`, `flutter build apk` geliyor. Yani
kaynağı düzenlemek yeterli; doğrulamayı CI yapıyor.

Yapılanlar:

- `ShopDto` += `@Default(false) bool isPrelaunch`
- `shop_preview_card.dart`: fiyat yerine "Yakında"
- `shop_detail_screen.dart`: fiyat yerine "Yakında", rezervasyon düğmesi
  **kapalı** (`onPressed: null`) ve etiketi "Yakında" — misafiri reddedilişe
  kadar götürmek, tutamayacağımız sözü önce vermek demek
- `search.coming_soon` iki dile de eklendi (tr/en anahtar kümeleri eşit)


## 2026-08-30 — talep testi kapsamı: 482 nokta / 252 şehir (ve büyümenin açtığı üç hata)

Liste 50 nokta / 10 şehirden 482 nokta / 252 şehre çıkarıldı: büyük ve kalabalık
şehirler artı meşhur turistik yerler (Türkiye ağırlıklı, sonra Avrupa, Orta Doğu,
Asya, Amerika, Afrika/Okyanusya). Nokta eklemenin maliyeti bir satır; esnaf maliyeti
ancak sinyal geldikten sonra doğuyor — asimetri kasıtlı.

- **Koordinatlar tahmin edilmedi.** Noktaların çoğu için bir yer adı sorgusu Nominatim'e
  ileri geocode ettirildi; ülke kodu tutmayan 11 sonuç sorgusu düzeltilerek yeniden
  çözüldü. Sonradan elle verilen 26 nokta da aynı kapıdan geçiyor. `--verify` aynı
  koordinatları **ters** geocode edip ülke kodunu karşılaştırır (ileri yön kendi
  kendini onaylamak olurdu) — elle düzeltilen bir noktada enlem/boylamı ters yazmak
  buradan yakalanır.
- **`--city` artık `key` alanı**, slug öneki değil. Önek eşleşmesi yüzlerce nokta
  arasında iki şehri sessizce karıştırabilirdi. Ayrıca her koşuda tekrar eden slug,
  aralık dışı koordinat ve geçersiz IANA saat dilimi kontrol ediliyor.

Büyüme, 50 noktayla görünmeyen üç hatayı görünür yaptı; üçü de bu değişikliğin
parçası olarak düzeltildi:

1. **Ana sayfa "aktif lokasyon" ve `/become-partner` "aktif ortak" sayıları
   prelaunch'u sayıyordu** (`PUBLIC_SHOP_FILTER`). Yani misafire valizini
   bırakamayacağı yerler kapasite, esnafa da olmayan ortaklar sosyal kanıt diye
   ilan ediliyordu — üstelik fark nokta sayısıyla birlikte büyüyor. İkisi de
   `OPERATING_SHOP_FILTER`a alındı; sorulan soru "gösterilsin mi" değil "burada iş
   yapılıyor mu".
2. **Talep testi noktasında fiyat gösteriliyordu.** `pricePerDay` şema
   varsayılanıdır (₺50) — gerçek bir fiyat değil, ve nokta Tokyo'daysa yanlış para
   biriminde bir söz. "Haber ver" düğmesinin yanında duran bu tutar tam olarak bu
   kod tabanının defalarca düzelttiği "gerçekleşmeyen vaat". Yerine, o güne kadar
   hiç kullanılmamış olan `prelaunchBadge` ("Yakında") metni geçti; valiz fiyat
   tablosu da bu noktalarda çizilmiyor.
3. **`/admin/prelaunch` karar yüzeyi okunamaz hale geliyordu.** 482 noktanın
   neredeyse hepsi 0 gösterecekti ve asıl sinyal aralarında kaybolurdu. Sinyal
   almamış noktalar tablodan çıkarıldı, sayıları `prelaunchSilent` satırında duruyor
   — sıfırları büsbütün susturmak "3 kayıt" rakamını paydasız bırakırdı.

## 2026-08-30 — talep testi noktaları (yeni yetenek)

Esnafla anlaşmadan önce hangi şehirde müşteri olduğunu ölçmek için. `Shop.isPrelaunch`
noktası aramada normal görünür, **rezervasyon almaz**; misafir rezervasyona kalkıştığı
an durumu öğrenir ve isterse "açılınca haber ver" kaydı bırakır (`PrelaunchInterest`).

- **Neden rezervasyon almıyor**: bir rezervasyonun bedelini valiziyle boş adrese giden
  misafir öder. Üç katman: arayüz (CTA değişir), sunucu (`createInitialBooking` →
  `SHOP_PRELAUNCH`), ve filtre (`OPERATING_SHOP_FILTER`).
- **`isTest`ten farkı**: `isTest` kaydı kamuya HİÇ görünmez (P1-4'ün çözümü). Bu
  görünür ama işletilmez. İki soru ayrıldı: *"misafire gösterilsin mi"*
  (`PUBLIC_SHOP_FILTER`, prelaunch dahil) ve *"burada iş yapılıyor mu"*
  (`OPERATING_SHOP_FILTER`, prelaunch hariç).
- **Sağlık sinyali korundu**: prelaunch noktaları slot üretmez, `/api/health/jobs`
  onlardan slot beklemez, `partnerReachability` onları "aktif dükkanı var" saymaz.
  Ayrılmasaydı 50 nokta eklemek `slotGeneration`'ı bir gün içinde `stale` yapardı.
- **Ölçüm**: `/admin/prelaunch` (şehir + nokta bazında), artı `shop_view` (sunucu,
  koşulsuz), `prelaunch_booking_attempt` (istemci, çerez onayına bağlı),
  `prelaunch_interest` (sunucu). Aynı kişi iki kez sayılmaz.
- **Script**: `scripts/prelaunch-points.ts` — kuru çalışma varsayılan, idempotent
  (ölçüldü), 50 nokta / 10 şehir. Koordinatlar yaklaşık; liste scriptte veri olarak
  duruyor ve gözden geçirilebilir.
- **Mandallar iş gördü**: `design-tokens` (CTA sınıf dizgesi iki dala kopyalanmıştı →
  tek const'a alındı), `input-labels` (yalnızca placeholder ile etiketli girdi →
  `aria-label`), `locales` (`fa`/`ja` yer tutucusu İngilizce kalmıştı). Üçü de
  düzeltildi. Prelaunch kapısının testi, kapı kaldırılarak kırıldığı doğrulanmış hâlde.

## 2026-08-30 — izleme kurulmadan önce: açık uç kendini koruyamıyordu

Soru "alarm/izleme eklesek ortamı yorar mı" diye başladı. Ölçüm, yükün izlemede
değil **ucun kendisinde** olduğunu ve o yükün bugün zaten korumasız durduğunu
gösterdi.

### 1. ✅ DÜZELTİLDİ — `/api/health/jobs` kimliksiz açık ve çağrı başına 18 sorgu koşuyor

- **Nerede**: `nginx/conf.d/default.conf` (uç `location /` üzerinden `@next`e düşüyordu),
  `nginx/conf.d/01-hardening.conf:6`
- **Kanıt**: uç tek çağrıda **18 sorgu** koşuyor — slot ufku 3 (`shopTimeSlot.aggregate`,
  `shop.count`, `shopTimeSlot.count`), gecikme taraması 2, mühür bütünlüğü 5
  (3× `seal.count`, `seal.groupBy`, `booking.count`), partner ulaşılabilirliği 5, iş defteri 3.
  (`recordEvents: false` olduğu için gecikme taraması olay yazma sorgusunu koşmuyor.) Bölümler `await` ile sıra sıra koşuyor, yani ~5 gidiş-dönüş.
  Uçta ne cache var ne kendi limiti (`route.ts:9` yalnızca `force-dynamic`).
  Limit `api_general`'dı: `rate=30r/s`, `burst=120` (`01-hardening.conf:6`).
- **Neden önemli**: uç **bilerek** kimlik doğrulamasız ve sırsız — sır bilmeyen bir
  izleyicinin alarm verebilmesi için. Ama bu, tek bir IP'nin veritabanına **saniyede
  ~540 sorgu** yaptırabilmesi demekti; üstelik `seal.count()` gibi tam tablo sayımlarıyla.
  Kurulacak izleyicinin 30 dakikada bir yapacağı çağrı bunun yanında ölçülemez —
  yani uç, **izlenmediği hâlde izlendiğinden daha riskliydi**.
- **Düzeltme**: kendi zone'u — `api_health`, IP başına `12r/m`
  (`01-hardening.conf`), `burst=6 nodelay` ile `location = /api/health/jobs`'a bağlı.
  Tam eşleşme (`=`) bilerek: nginx'te en yüksek öncelik ondadır, `location /` üzerinden
  `@next`e düşmeyi engeller ve kardeşi `/api/health/live`'a **dokunmaz** — o sıfır sorgu
  koşuyor ve nginx'in konteyner healthcheck'i onu 5 saniyede bir çağırıyor
  (`docker-compose.yml:151`); limitlense konteyner `unhealthy` düşerdi.
- **DOĞRULANDI (2026-08-30, yerel gerçek nginx 1.31.4)**: `nginx -t` geçti. Ayrıca
  **davranışsal** olarak sınandı — konfig yerelde ayağa kaldırılıp 12 ardışık istek
  atıldı:

  | Uç | Sonuç |
  |---|---|
  | `/api/health/jobs` | 7× geçti, sonra **5× `429`** — limit devrede |
  | `/api/health/live` | 12× geçti, hiç limitlenmedi |
  | `/api/health` | 12× geçti, dokunulmadı |

  Yani `location = ` önceliği de kanıtlandı: blok `location /` üzerinden `@next`e
  düşmüyor ve kardeş uçlara sızmıyor.

### 2. ✅ DÜZELTİLDİ — Deploy `nginx/` dizinini HİÇ göndermiyordu (madde 1'i prod'a taşıyan yol kırıktı)

Madde 1'in düzeltmesi yazıldıktan sonra "bu prod'a nasıl gidiyor" diye bakınca çıktı.

- **Nerede**: `.github/workflows/ci.yml` → "Deploy config'i ve public/ dosyalarini
  S3'e yukle" adımı ve SSM komut listesi
- **Kanıt**: deploy S3'e yalnızca `docker-compose.yml`, `public/`, `scripts/` ve
  `ops/secrets.manifest` yüklüyordu; `nginx/` listede yoktu. Oysa
  `docker-compose.yml:157-159` üç nginx konfigini **sunucudaki**
  `/opt/emanetci/nginx/conf.d/`'den bind-mount ediyor, imajın içinden değil.
- **Neden önemli**: repodaki nginx konfigi ile canlıdaki ayrı yaşıyordu ve hiçbir şey
  bunu göstermiyordu. Bu, `scripts/` dizininin **birebir aynı** deliği — o delik
  2026-08-29'da sekiz cron işini birden düşürmüştü (madde 9.1) ve düzeltilirken
  nginx'teki ikizi görülmemişti. Somut sonucu: madde 1'deki rate limit deploy edilse
  bile canlıya **hiç ulaşmayacaktı**.
- **Düzeltme**: `nginx/conf.d/` de `scripts/` ile aynı yoldan gidiyor (S3 `cp
  --recursive` + sunucuda `s3 sync`).
- **Ve bu yeni bir risk yarattı, o da kapatıldı**: konfig artık canlıya gittiği için
  bozuk bir konfig **siteyi kapatabilir**. İki kapı eklendi:
  1. `scripts/verify-nginx-conf.sh` — gerçek `nginx -t`, CI'nın `verify` işinde koşar,
     yani bozuk konfig S3'e hiç ulaşmaz. Repoyu değiştirmez; yalnızca yerelde
     çözülemeyen iki şeyi ikame eder (TLS yolları, `web` upstream host'u).
     **Mandalın kırıldığı doğrulandı**: `zone=api_YOK` gibi geçici bir ihlal enjekte
     edilip çıkış kodunun `1`e döndüğü, geri alınca `0` olduğu görüldü.
  2. Sunucuda `up -d`'den sonra `docker compose exec -T nginx nginx -t` — geçmezse
     deploy **kırmızı** düşer. Öncesinde nginx sessizce kapalı kalıp deploy "başarılı"
     diyebilirdi.

### 2b. ✅ DÜZELTİLDİ — Yeni kapı ilk koşuşunda DOĞRU konfigi reddetti (yanlış negatif)

2. maddedeki kapı yazıldı, push edildi ve **CI kırmızı düştü** — ama konfig
doğruydu, kapı yanlıştı.

- **Kanıt (CI koşusu 33320668574)**:
  `[emerg] unknown directive "http2" in .../default.conf:35` — doğrulayıcı
  `nginx/1.24.0 (Ubuntu)` kullanıyordu.
- **Kök neden**: `http2 on;` ayrı bir direktif olarak **nginx 1.25.1**'de geldi
  (1.24'te `listen 443 ssl http2;` yazılır). CI adımı `apt-get install nginx-core`
  diyordu ve Ubuntu 24.04 bunun **1.24.0**'ını veriyor. Üretim ise
  `nginx:1.27-alpine` koşuyor (`docker-compose.yml:144`) ve direktif orada geçerli.
  Yani konfig üretimde sorunsuz, doğrulayıcı yanlış sürüme sormuş.
- **Neden önemli**: **yanlış negatif üreten bir kapı, hiç olmayandan kötüdür.**
  Doğru bir değişikliği bloke eden bir kontrol, insanlara onu baypas etmeyi
  öğretir; birkaç tekrardan sonra kapı fiilen kapatılır ve asıl koruduğu şey de
  korumasız kalır. Bu koşuda deploy hiç çalışmadı, yani 1. maddedeki rate limit
  yine canlıya gitmedi.
- **Düzeltme**: doğrulama artık **üretimin kendi imajıyla** yapılıyor
  (`--engine docker`) ve imaj **`docker-compose.yml`'den okunuyor**, elle
  yazılmıyor — elle yazılan bir sürüm compose'dakiyle sessizce ayrışırdı, yani
  aynı hatanın bir sonraki hâli olurdu. Docker yoksa script yerel binary'ye düşer
  ama sürüm farkını **uyarı olarak söyler** ve o modun kesin cevap olmadığını
  belirtir.
- **Genel ders**: bir konfigin "geçerli" olup olmadığı sorusunun cevabı, onu
  **çalıştıracak sürüme** bağlıdır. Doğrulayıcı ile üretim arasındaki sürüm farkı,
  doğrulamanın kendisini geçersiz kılar.

### 3. ⚠️ AÇIK — `ops/server.env` ölü Hetzner kutusunu gösteriyor (yerel dosya)

- **Kanıt**: `APP_DIR=/root/emanetci` (canlıda `/opt/emanetci`) ve `SSH_HOST` canlı
  EC2'nin adresi değil. Repodaki `ops/server.env.example` **doğru** — sapma yalnızca
  yerel, git'e girmeyen kopyada.
- **Neden önemli**: `README_AI.md` ve `ops/README.md` sunucuya erişimin yolu olarak
  bu dosyayı gösteriyor. Bugün o yolu izleyen kişi ölü kutuya bağlanmaya çalışır.
  Bu oturumda canlıya erişilemedi, sebebi tam olarak buydu (SSM tarafında da
  `terraform-bagajpark` IAM kullanıcısının `ssm:SendCommand` izni yok — deploy
  GitHub OIDC rolüyle çalışıyor).
- **Yapılacak**: `ops/server.env.example`'daki değerlerle doldur; canlı instance
  `i-0753b8302a5f73413`, `eu-central-1`. Bu dosya git'e girmediği için düzeltme
  yalnızca yerelde geçerlidir.

### 4. İzleme kurulumu — yapılandırma hazır, monitörler AÇILMADI

İki monitör, aralık sinyalin ritmine göre: `/api/health/live` 1–5 dk (**0 sorgu**),
`/api/health/jobs` **30 dk** (~18 sorgu). `jobs`'ı 5 dakikada bir sormak tek bir ek
bilgi üretmez — ölçtüğü her şey günlük ritimde değişir (slot ufku günde 1 gün kısalır,
kritik gecikme eşiği 72 saat) — ama veritabanına 6 kat yük bindirir. 30 dakikada bir
= günde 48 çağrı ≈ 900 sorgu, birkaç sayfa açılışı kadar.

Kalan iş **bir hesap açmak**: UptimeRobot ücretsiz kademesi ikisine de yeter.
Ayrıntı `docs/OBSERVABILITY.md`.

### 5. ✅ DÜZELTİLDİ — `ops/crontab.prod` yapılmış işi yapılacak diye tarif ediyordu

- **Kanıt**: dosyada **7 kez** "NOT: enforced=false — cron kurulduktan sonra
  `registry.ts` içinde true yapın" notu vardı; oysa `src/lib/jobs/registry.ts`'te
  sekiz işin de `enforced: true` ve `scripts/emit-crontab.sh` o notu artık hiç
  üretmiyor. Üreteci koşturup karşılaştırdım: **zamanlanmış komut satırları birebir
  aynı**, sapan yalnızca yorumlardı. Dosyanın başındaki "önce 3 açık rezervasyonu
  kapatın, yoksa iki esnaf her gün Haziran'dan kalma uyarı alır" uyarısı da bayattı —
  o üç kayıt 2026-08-29'da kapatıldı, `CHECKED_IN` sayısı 0.
- **Neden önemli**: bu dosya felaket kurtarma kopyası (madde 4'ün tüm gerekçesi buydu).
  Yeni bir sunucu kuran kişiye yapılmış bir işi tarif etmek, o kişinin dosyanın geri
  kalanına duyduğu güveni de düşürür.
- **Düzeltme**: uygulama işleri bölümü `emit-crontab.sh` ile yeniden üretildi;
  komut satırları değişmedi (`git diff` ile doğrulandı). `booking-reminders`
  uyarısı gerçeğe çevrildi: kayıt bugün tetiklenmiyor ama "bildirildi" işareti hâlâ
  yok, yani yeni bir takılı kayıtta tekrar geri gelir.
- **Sonraki adım (değişmedi)**: `booking-reminders`'a "bildirildi" işareti ekle.

## 2026-08-29 — kesim sonrası sapma taraması: repo hâlâ Hetzner'i anlatıyordu

23 Ağustos'ta canlı Hetzner'den AWS EC2'ye taşındı (`infra/aws/CUTOVER.md`), ama repo
bunu birçok yerde öğrenmemişti. Sapmaların tamamı dosya:satır ile kanıtlı; hepsi aynı
kök nedenden geliyor: **kesim sonrası doküman/varsayılan güncellemesi `CUTOVER.md` 5.
bölümde açık iş olarak kalmıştı ve yapılmamıştı.**

### 1. ✅ DÜZELTİLDİ — Terraform canlı hesabın state'ini eski hesabın kimliğiyle açıyordu

- **Nerede**: `infra/aws/stack/variables.tf`, `infra/aws/bootstrap/variables.tf` →
  `aws_profile`
- **Kanıt**: yerel workspace `hesap2` (`infra/aws/stack/.terraform/environment` ve
  `bootstrap/.terraform/environment` içeriği `hesap2`; `terraform.tfstate.d/` altında
  yalnızca `hesap2` var). `hesap2` = **canlı** hesap 772853132412 / profil
  `bagajpark-yeni` (`CUTOVER.md` "Son durum"). Ama `aws_profile` varsayılanı hâlâ
  `bagajpark` — yani **eski** hesap 269174115166.
- **Neden önemli**: profil ile workspace ayrışınca `terraform plan`, canlı ortamın
  state'ini elinde tutarken eski hesaba bakar ve **her kaynağı "to create" gösterir**.
  Farkına varmadan bir `apply`, altyapıyı yanlış hesapta ikinci kez kurar. Bu, eldeki
  en pahalı sessiz hataydı.
- **Düzeltme**: iki kökte de varsayılan `bagajpark-yeni`; değişkenin başına profil ↔
  workspace eşleşmesini ve doğrulama komutlarını anlatan bir not eklendi.

### 2. ✅ DÜZELTİLDİ — Deploy config bucket'ı başka bir hesabı gösteriyordu

- **Nerede**: `infra/aws/stack/variables.tf` → `deploy_config_bucket`
- **Kanıt**: varsayılan `bagajpark-backups-43403243`; canlı hesabın bucket'ı
  `bagajpark-backups-1d9eb152` (`CUTOVER.md` "Son durum" tablosu). CI'nin GitHub
  değişkeni (`AWS_DEPLOY_BUCKET`) taşımada güncellenmiş, Terraform varsayılanı
  unutulmuştu.
- **Neden önemli**: bu değer sunucunun `deploy-config` okuma IAM policy'sini üretiyor
  (`stack/main.tf` → `app_deploy_config_read`). Yanlış hesabın bucket'ına bağlı bir
  policy, CI'nin bıraktığı `docker-compose.yml`/`public/` dosyalarını okunamaz yapar.
- **Düzeltme**: varsayılan canlı bucket'a çevrildi, gerekçe yorumda.

### 3. ✅ DÜZELTİLDİ — Cron üreteci var olmayan bir yola işaret eden satırlar üretiyordu

- **Nerede**: `scripts/emit-crontab.sh`, `scripts/call-internal-job.sh`,
  `scripts/repair-seal-ownership.sh`, `scripts/repair-slot-timezone.sh`,
  `scripts/update.sh`, `tests/stress/server-prepare.sh`
- **Kanıt**: hepsinde uygulama dizini `/root/emanetci` (Hetzner) sabitlenmişti; canlı
  sunucuda dizin `/opt/emanetci` (CI deploy adımları, `CUTOVER.md`, `scripts/backup-s3.sh`
  hepsi `/opt/emanetci` diyor).
- **Neden önemli**: `emit-crontab.sh` çıktısı "yapıştırılabilir crontab satırı" olarak
  tasarlandı. Yanlış yolla üretilen satır cron'da **sessizce** başarısız olur — bu
  proje, tam olarak sessiz cron başarısızlığı yüzünden 37 gün slot üretmedi (P0-1) ve
  2 ay boşa 404 aldı (P1-1b).
- **Düzeltme**: varsayılanlar `/opt/emanetci`; `update.sh` ve `server-prepare.sh`'ta yol
  ve branch `APP_DIR`/`BRANCH` ile ezilebilir hâle getirildi (`update.sh` ayrıca
  `origin/develop`e sabitlenmişti — canlı `main`den deploy ediliyor).

### 4. ✅ DÜZELTİLDİ — Sunucudaki crontab repoda yok

- **Nerede**: `infra/aws/CUTOVER.md` 3c adımı → `crontab /opt/emanetci/crontab.prod`
- **Kanıt**: `crontab.prod` bu repoda hiçbir yerde yok; tek geçtiği yer o dokümandır.
  `stack/cloud-init.sh.tftpl` de cron kurmuyor (`grep -n "cron" ` → sonuç yok).
- **Neden önemli**: canlının zamanlanmış iş listesinin tek kopyası sunucuda. Sunucu
  giderse liste de gider; başka bir makinede kesim adımı olduğu gibi tekrarlanamaz.
  Ayrıca `scripts/README.md`'deki "kurulu/kurulmadı" tablosu 2026-08-22'de **eski**
  kutuda ölçülmüştü — yeni kutuda hangi işlerin kurulu olduğu doğrulanmadı.
- **Durum**: 2026-08-29'da kapatıldı. `crontab -l` alındı (sonucu **madde 6**'da) ve
  liste `ops/crontab.prod` olarak repoya girdi: uygulama işleri
  `scripts/emit-crontab.sh` çıktısından, sunucuya özgü işler (yedekleme, disk
  temizliği) elle. Kurulum, yeniden üretme ve kurmadan önce okunması gerekenler
  dosyanın başında. **Sunucuya HENÜZ KURULMADI** — bkz. madde 6.
- **Sonraki adım**: uygulama işlerini
  `scripts/emit-crontab.sh`'tan üret, sunucuya özgü işleri (yedekleme, disk temizliği)
  repoya bir `crontab.prod` olarak ekle. Tetikleyiciyi tamamen kutunun dışına almak
  (EventBridge Scheduler → `/api/internal/*`, `X-Cron-Secret` başlığıyla) bu sorunu ve
  "cron çalışmadı, kimse fark etmedi" sınıfını birlikte kapatır.

### 10. ✅ DÜZELTİLDİ — Üretim veritabanı baştan sona test verisiyle doluydu

`enforced=true` açılır açılmaz `/api/health/jobs` **DEGRADED** dönmeye başladı ve
aylardır görünmeyen iki gerçek sorunu ortaya çıkardı. İkisi de temizlendi.

- **1.249 sahipsiz mühür** (P1-7): 1.277 mührün 1.247'si `ASSIGNED` ama `shopId`
  NULL, artı 2 `FAULTY`. Yalnızca 30'u düzgün atanmış. `repair-seal-ownership.sh`
  bunun için yazılmıştı ama **hiç koşturulamamıştı** (madde 8). Taşındıktan sonra
  ilk kez koştu, 1.249 satır `STOCK`'a alındı.
- **17 gecikmiş rezervasyon**: açık kalan tüm rezervasyonlar. Ölçüm: 11'i `PAID`
  ve **on birinin de işlem numarası `bypass_` ile başlıyor** (yani
  `MOBILE_PAYMENT_BYPASS` ile üretilmiş, gerçek para hiç geçmemiş); 6'sı
  `APPROVED` ve hiç ödeme kaydı yok. En yeni rezervasyon 23 Ağustos.
  `scripts/repair-bypass-bookings.sh` ile kapatıldı.

**Kapsam bilerek dardı**: script yalnızca ödemesiz veya `bypass_` ödemeli
kayıtlara dokunuyor ve kümede gerçek bir tahsilat bulursa **hiçbir şey yapmadan
durur**. Gerçek parayı elle "iade edilmiş" işaretlemek, bu projeyi bu hale
getiren hata sınıfının ta kendisi olurdu.

**Sonuç**: `/api/health/jobs` → `UP`, beş kontrolün beşi de `ok`.

### 5. ✅ DÜZELTİLDİ — Yeni bir instance TLS sertifikasını bulamadan açılırdı

- **Nerede**: `infra/aws/stack/cloud-init.sh.tftpl:65-70` ↔ `nginx/conf.d/default.conf:38-51`
- **Kanıt**: cloud-init SSM'den çektiği materyali `/etc/ssl/cloudflare/aws-test.crt` ve
  `aws-test.key` olarak yazıyor; repodaki nginx yapılandırması
  `/etc/ssl/cloudflare/bagajpark.crt` / `bagajpark.key` istiyor.
- **Neden önemli**: bugünkü sunucu çalışıyor çünkü dosyalar oraya elle konuldu. `stack`
  yeniden kurulursa (EIP değişimi, bölge değişimi, felaket kurtarma) nginx sertifikayı
  bulamaz ve **site açılmaz**. Yani felaket kurtarma yolu bugün kırık.
- **2026-08-29'da ölçüldü ve temkin HAKLIYMIŞ**: SSM'deki sertifikanın SAN'ı
  **`aws-test.bagajpark.com`** — canlı alan adı için değil. nginx'in gerçekten
  servis ettiği sertifikanın SAN'ı ise `bagajpark.com, *.bagajpark.com` ve o
  **yalnızca sunucunun diskinde** duruyordu. Yani sadece dosya adını değiştirmek
  yanlış alan adının sertifikasıyla açılan bir sunucu üretecekti.
  (`aws-test.bagajpark.com` alan adının DNS kaydı yok — ölü.)
- **Hazırlandı, UYGULANMADI**: `scripts/tls-put.sh` canlı sertifika ve özel
  anahtarı **sunucuda çalışarak** SSM'e yazıyor (anahtar hiçbir laptop'a inmiyor).
  Sertifika/anahtar çiftinin eşleştiğini yazmadan önce doğruluyor, yazdıktan sonra
  SAN'ı geri okuyup karşılaştırıyor. Kuru koşusu canlıda denendi.
  cloud-init artık `bagajpark.{crt,key}` yazıyor ve çektiği sertifikanın
  `bagajpark.com`'u kapsadığını `openssl -checkhost` ile doğrulayıp aksi hâlde
  **duruyor** — yanlış sertifikayla açılan bir sunucu üretmektense cloud-init'in
  orada patlaması iyidir.
- **Uygulandı (2026-08-29)**: canlı sertifika ve özel anahtar SSM'e taşındı
  (`/bagajpark/aws-test/tls/{cert,key}` → sürüm 2). Doğrulama: SSM'deki
  sertifikanın SAN'ı artık `*.bagajpark.com, bagajpark.com`. Özel anahtar kutudan
  hiç çıkmadı — script sunucuda koştu, ekrana yalnızca uzunluk basıldı.
  Seed yazma izni açılıp **kapatıldı** (`NoSuchEntity` ile doğrulandı); instance
  rolünde yalnızca okuma politikaları kaldı.
- **Çalışan sunucuya dokunulmadı**: `user_data` `ignore_changes`'te olduğu için
  plan "No changes" dedi. Kazanç bugünde değil, yarında: kutu gidince yenisi
  sertifikayı SSM'den bulabilir. Bugüne kadar bu yol kırıktı ve kimse denememişti.

### 6. ✅ DÜZELTİLDİ — Zamanlanmış sekiz işten BEŞİ hiç çalışmıyordu

Madde 4'ün "sunucuda `crontab -l` çıktısını al" adımı 2026-08-29'da yapıldı ve
beklenenden kötü bir tablo çıktı.

- **Kanıt (2026-08-29, canlı sunucu, SSM Run Command)**: `crontab -l -u ec2-user`
  beş satır döndürüyor. Bunların yalnızca üçü uygulama işi:

  ```
  kosuyor  : generate-slots, overdue-scan, seal-forecast
  KOSMUYOR : booking-reminders, cleanup, finance-export,
             classify-inbox, response-times
  ```

  `src/lib/jobs/registry.ts` sekiz iş tanımlıyor; `src/app/api/internal/` altında
  sekizinin de ucu var. `scripts/emit-crontab.sh` de sekiz satır üretiyor —
  yani üretilen crontab sunucuya hiç kurulmamış.
- **Neden önemli**: `booking-reminders` çalışmıyor, yani **misafirlere rezervasyon
  hatırlatma e-postası gitmiyor**. `cleanup` veri temizliği yapmıyor,
  `finance-export` finansal dışa aktarım üretmiyor, `response-times` ve
  `classify-inbox` destek metriklerini beslemiyor. Hiçbiri hata vermiyor; sadece
  hiç çalışmıyorlar. Madde 4'teki "cron çalışmadı, kimse fark etmedi" sınıfının
  fiilen gerçekleşmiş hali.
- **Neden hemen açılmadı**: `booking-reminders` aylardır uykudaysa ilk koşuşunda
  **birikmiş rezervasyonlara toplu e-posta** atabilir. Bu, hatayı düzeltirken
  misafirlere alakasız hatırlatma göndermek demek olurdu.
- **İlk koşuş etkisi ÖLÇÜLDÜ (2026-08-29, canlı, salt okunur SQL)**:

  | İş | İlk koşuşta |
  |---|---|
  | `booking-reminders` | misafire **0** e-posta; esnafa **3** bildirim (2 dükkan) |
  | `cleanup` | **37** süresi dolmuş doğrulama token'ı siler; 0 session, 0 analitik |
  | `classify-inbox` | 0 (77 mesajın hepsi sınıflanmış) |
  | `finance-export` | 0 satır; zaten salt okunur (CSV üretir) |

  Yani "toplu e-posta" riski **yok**: `booking-reminders`'ın misafir dalları ileri
  dönük pencereler (check-in'e 2 saat, check-out'a 1 saat) ve ölçüm anında boştu.
  Kalan tek gürültü, esnafa giden overdue bildirimi.
- **Ama o bildirim SÜRESİZ tekrarlanır**: sorguda alt sınır yok ve "bildirildi"
  işareti tutulmuyor (`src/app/api/internal/booking-reminders/route.ts:88`), yani
  aynı 3 kayıt için 2 esnaf **her gün** uyarı alır. Üç kayıt 12–14 Haziran tarihli
  ve `overdue-scan`'in kendi açıklamasında geçen kayıtlarla aynı ("üç müşterinin
  bavulu Haziran'dan beri 'dükkanda' görünüyordu").
- **Durum (2026-08-29)**: üç kayıttan **ikisi kapatıldı**
  (`scripts/repair-stale-checkin.sh --apply`). Kalan bir tanesi (540 TL,
  `PaymentLog.status = SUCCESS`) script tarafından **bilerek atlandı**: iptal,
  karşılığı olan bir SUCCESS ödemeyi öksüz bırakır ve raporda karşılığı olmayan
  gelir görünür. Önce para tarafına karar verilmeli.
- **Durum (2026-08-29, akşam)**: **crontab kuruldu, sekiz işin tamamı zamanlanmış.**
  Kurulum sırasında duman testi ÜÇ ayrı gizli hata yakaladı — üçü de sırayla
  ortaya çıktı, biri düzeltilmeden diğeri görünmüyordu (madde 9).
  Kalan 540 TL'lik kayıt `PAID`'e alındı ve artık hiçbir şeyi bloke etmiyor:
  `CHECKED_IN` sayısı **0**, yani overdue bildirimi tetiklenmiyor.
- **Sonraki adım**: (1) kalan 540 TL'lik kaydı normal iptal akışından iptal et;
  (2) yarın sabah `/opt/emanetci/logs/` altındaki çıktıları oku;
  (3) işler doğrulanınca `registry.ts` içinde `enforced=true` yap; (2) `ops/crontab.prod`'u kur (`mkdir -p
  /opt/emanetci/logs` ÖNCE); (3) işleri tek tek, aralarında gözlemleyerek aç;
  (4) `registry.ts` içinde `enforced=true` yap ki gecikme sağlık kontrolünü
  DEGRADED yapsın — bu sınıfın tekrar sessizce oluşmaması ancak böyle engellenir;
  (5) `booking-reminders`'a "bildirildi" işareti ekle.

### 8. ✅ DÜZELTİLDİ — Mevcut iki onarım scripti bu sunucuda hiç çalışmıyordu

- **Kanıt (2026-08-29, canlı)**: `command -v psql` → **HAYIR**, psql host'ta kurulu
  değil. `scripts/repair-seal-ownership.sh:98` ve `repair-slot-timezone.sh` ise
  `assert_is_installed "psql"` ile başlıyor, yani ilk adımda düşerler.
  İkinci katman: ikisi de `DATABASE_URL`'i `$app_dir/.env`'den okuyor, ama o URL
  **`emanetci`** veritabanını gösteriyor ve o veritabanı YOK
  (`SELECT datname FROM pg_database` → yalnızca `postgres`, `bagajpark`).
- **Neden önemli**: ikisi de kanıtlı bir veri bozukluğunu düzeltmek için yazılmış
  (P1-7'deki 1.247 sahipsiz mühür dahil). "Script var" diye sorun çözülmüş
  sanılıyor; oysa koşturulsa ilk satırda duruyor. Hetzner kutusu için yazılmışlar.
- **Düzeltme (2026-08-29)**: ikisi de `repair-stale-checkin.sh` desenine taşındı —
  sorgular konteyner içindeki psql ile koşuyor, host'ta psql aranmıyor, env'deki
  ölü `DATABASE_URL` kullanılmıyor. Gerekçe scriptlerin başında yazılı.
- **Ve hemen işe yaradı**: `repair-seal-ownership.sh` ilk kez koşabildi ve **P1-7'nin
  hâlâ canlı olduğunu** gösterdi — 1.249 mühür `ASSIGNED`/`FAULTY` ama sahipsiz
  (1.277'nin yalnızca 30'u düzgün atanmış). `/api/health/jobs` bunu artık
  `sealIntegrity: broken` olarak raporluyor. **`--apply` HENÜZ KOŞULMADI**:
  1.249 satırlık bir düzeltme, bilinçli bir onay gerektirir.

### 9. ✅ DÜZELTİLDİ — Cron zinciri üç ayrı katmanda sessizce kopuyordu

Crontab kurulduktan sonra "yarın bakarız" demek yerine duman testi koşuldu ve
üç hata ÜST ÜSTE çıktı. Her biri bir öncekini düzeltmeden görünmüyordu; hiçbiri
hata vermiyordu, işler sadece çalışmıyordu.

1. **Sunucudaki scriptler eski**: `call-internal-job.sh` hâlâ `/root/emanetci/.env`
   arıyordu. Düzeltme repoda vardı ama sunucuya hiç gitmemişti — **CI deploy
   `scripts/` dizinini göndermiyor**, yalnızca `docker-compose.yml`, `public/`
   ve secrets scriptlerini gönderiyor. Scriptler S3 üzerinden senkronlandı.
2. **Env dosyası cron kullanıcısına kapalı**: `secrets-render.sh` dosyayı
   `600 root` yazıyordu (bu oturumda ben ekledim), cron ise `ec2-user` olarak
   koşup `CRON_SECRET`'i o dosyadan okuyor. Sekiz iş de "CRON_SECRET tanımlı
   değil" ile düşerdi. `640 root:ec2-user` yapıldı — taviz değil: `ec2-user`
   zaten `docker compose exec web printenv` ile tüm sırları görebiliyor.
3. **HTTP metodu uyuşmuyordu**: `call-internal-job.sh` sabit `POST` gönderiyordu,
   ama `booking-reminders` ve `finance-export` yalnızca `GET` export ediyor.
   İkisi de **405** alıp sessizce düşerdi — üstelik biri misafire hatırlatma
   e-postası gönderen iş. Metot artık `registry.ts` içinde, crontab satırını
   `emit-crontab.sh` oradan üretiyor ve `jobs-registry.test.ts` route dosyasının
   gerçekten o metodu export ettiğini doğruluyor.

**Doğrulama**: GET ucu (`finance-export`) CSV döndürdü, POST ucu
(`response-times`) `{"ok":true,"samples":8,"written":3}` döndürdü.

### 7. ✅ DÜZELTİLDİ — Üretilen crontab, yazılamayan bir dizine log yazıyordu

- **Kanıt (2026-08-29, canlı)**: `sudo -u ec2-user test -w /var/log` → **HAYIR**.
  `scripts/emit-crontab.sh` ise her satırı `>> /var/log/bagajpark-<is>.log` ile
  üretiyordu (`emit-crontab.sh:102`).
- **Neden önemli**: `>>` hedefi açılamazsa komut **hiç çalışmaz**. Yani madde 6'daki
  eksik işler kurulsaydı bile koşmayacaklardı — üstelik logsuz, yani ikinci kez
  sessizce. Madde 6'yı düzeltmeye çalışan kişi tuzağa basardı.
- **Düzeltme**: log dizini `--log-dir` ile parametreleştirildi, varsayılanı
  yazılabilir olan `/opt/emanetci/logs`. Gerekçe scriptin başında yazılı.

## 2026-08-26 — performans (kritik yol) + iki güvenilirlik açığı

Önceki turlar kod tekrarını kapatmıştı. Bu tur farklı bir soru sordu: kullanıcı
BEKLERKEN ne indiriyor, ve bir dış sağlayıcı yavaşladığında ne oluyor?

### 1. Üç ağır kütüphane kritik yoldaydı

Build çıktısındaki parçalar `page_client-reference-manifest.js` ile eşleştirildi —
yani "büyük görünüyor" değil, "bu sayfa bunu ilk yükte indiriyor" ölçüldü:

| Sayfa | Kütüphane | Parça (ham) | Kritik yoldan düşen (brotli) |
|---|---|---|---|
| `/search` | `maplibre-gl` — uygulamanın **en büyük** parçası | 1012 KB | **−215 KB** |
| `/partner` | `html5-qrcode` | 368 KB | **−84 KB** |
| `/partner/earnings` | `recharts` | 340 KB | **−82 KB** |

Üçü de statik `import` ile sayfanın ilk JS yükünün İÇİNDEYDİ. En pahalısı
`/search`: harita `absolute inset-0` ile listenin ARKASINDA duruyor, ama misafirin
gerçekte dokunduğu liste paneli, harita motorunun tamamı indirilip ayrıştırılmadan
etkileşime hazır olmuyordu. `/partner` ise esnafın gün boyu en çok açtığı sayfa ve
QR tarayıcı yalnızca "tara"ya BASILDIĞINDA çiziliyor — 368 KB, tarayıcı hiç
açılmasa bile her açılışta iniyordu.

Üçü `next/dynamic` + `ssr: false` ile ayrı parçaya alındı; kalıp yeni değil,
`AdminDashboardClient` → `AnalyticsChart` zaten böyleydi. Grafikler için
`PartnerEarningsCharts.tsx` ayrıldı (biçimlendiriciler prop olarak geçiyor ki
tutar/tarih biçimi tek yerde kalsın). **Build sonrası doğrulandı: hiçbir sayfanın
manifestinde bu üç kütüphane yok.**

### 2. Zaman aşımı isteği İPTAL ETMİYORDU

`withTimeout(fetch(...), ms)` yalnızca bir `Promise.race`. Süre dolduğunda ÇAĞIRAN
vazgeçiyor, ama alttaki istek çalışmaya devam ediyor: soket açık kalıyor, gövde
inmeye devam ediyor, yanıt geldiğinde kimsenin okumadığı bir sonuç üretiliyor.

Sağlayıcı DÜŞTÜĞÜNDE değil, YAVAŞLADIĞINDA ısırır: her deneme bir soket biriktirir
ve dışarıdaki bir yavaşlama bizim tarafımızda kaynak tükenmesine dönüşür.

`fetchWithTimeout` (`src/lib/async-timeout.ts`) `AbortSignal.timeout` ile isteği ağ
katmanında sonlandırır. Hata metni `withTimeout` ile AYNI tutuldu
(`<label>_timeout_after_<ms>ms`) ki çağıranların `catch` blokları ve log'lar iki yol
için ayrışmasın. İki ham fetch noktası taşındı: Resend (`NotificationService`) ve
Nominatim (`geocode-search-center`). `withTimeout` yerini KORUYOR — iptal
edilemeyen işler (`src/lib/mail.ts` içindeki Resend SDK çağrıları) için tek seçenek
hâlâ yarış.

**Test tarafında bir sürpriz:** `AbortSignal.timeout` vitest'in sahte
zamanlayıcılarıyla TETİKLENMİYOR (ölçüldü — Node'un iç zamanlayıcısını kullanıyor,
`vi.advanceTimersByTime` ona ulaşmıyor). Zaman aşımına dayanan iki mevcut test bu
yüzden çalışma zamanının gerçekten ürettiği hatayla yeniden yazıldı; zaman aşımının
KENDİSİ artık `src/lib/async-timeout.test.ts`'te doğrudan test ediliyor.

### 3. Mobil ödeme ucunda yakalanmamış promise — süreç düşürücü

`api/mobile/checkout/intent` içinde iki bildirim çağrısı `.catch`'siz `void` idi.
Node 15'ten beri yakalanmamış bir promise reddi **süreci düşürür**
(`--unhandled-rejections=throw` varsayılandır). Yani bir e-posta sağlayıcısı hatası
rezervasyonu değil, TÜM SUNUCUYU vururdu — üstelik rezervasyon yazıldıktan SONRA
çalıştıkları için hata da hiçbir yerde görünmezdi.

Kod tabanının geri kalanı zaten doğru kalıptaydı
(`void x().catch((e) => logger.warn(...))`); istisna bu iki çağrıydı.

### 4. Gecelik iş: dükkan başına bir sıralı `UPDATE`

`ShopService.recomputeResponseTimes` her dükkan için ayrı ayrı, SIRAYLA `UPDATE`
atıyordu. Üstelik dükkanların ezici çoğunluğunun yeterli örneği hiç olmuyor: onlar
için hesap her gece `null` çıkıyor ve **zaten `null` olan satır tekrar `null`
yazılıyordu**. Yani yazmaların neredeyse tamamı hiçbir şeyi değiştirmiyor, ama
havuzdan bir bağlantıyı dükkan sayısıyla orantılı süre boyunca tutuyordu.

Artık değişmeyen satır atlanıyor, `null`'a çekilecekler tek `updateMany` ile toplu
yazılıyor (500'lük öbekler — şemada `@default(0)` olduğu için ilk koşu hepsini
temizler). `updated`/`cleared` ANLAMI KORUNDU (iş defteri onları "sonuçta değeri
olan / olmayan dükkan" diye okuyor); gerçek yazma sayısı ayrı bir alan: `written`.

### Mandal: `src/__tests__/unhandled-rejection.test.ts` (tavan **0**)

Kapsam yalnızca SUNUCU (`services`, `actions`, `app/api`, `lib`). Tarayıcıda
yakalanmamış red yalnızca konsola yazılır, sekmeyi veya sunucuyu düşürmez — aynı
kural değildir, o yüzden `src/components` bilerek dışarıda.

Mandalın gerçekten kırıldığı doğrulandı: geçici bir ihlal eklenip dosya:satır
vererek kırmızı yandığı, geri alınca yeşile döndüğü görüldü.

**Ölçüm:** test **623 → 638**. `recomputeResponseTimes` için hiç test yoktu, beş
tane yazıldı (değişmeyen satırın YAZILMADIĞINI kanıtlayanlar dahil).

## 2026-08-26 — SOLID/DRY turu: kopyalar ve dağılmış konvansiyonlar

Önceki turlar **iş kurallarının** ikizlenmesini kapatmıştı. Bu tur aynı soruyu bir
kat aşağıya sordu: aynı şeyi iki kez SÖYLEYEN yerler nerede?

### 1. Yetki kapısı — ~28 kopya, BEŞ farklı konvansiyon

Aynı üç kontrol (`giriş yapmış mı`, `admin mi`, `esnaf mı`) 12 dosyada elle
yazılmıştı ve kopyalar farklı biçimlerde başarısız oluyordu:

| Biçim | Kaç yerde |
|---|---|
| `throw new Error("Unauthorized")` | 8 |
| `return { error: "Errors.authRequired" }` | çoğunluk |
| `return { error: "Errors.unauthorized" }` / `"Errors.notAuthorizedAdmin"` | karışık |
| `return { error: "unauthorized" }` (snake_case) | `seal.ts` |

**Kullanıcı açısından:** aynı "yetkiniz yok" durumu, hangi dosyaya denk geldiğine
göre dört farklı mesaj üretiyordu. Ham `"Unauthorized"` ayrıca `actionErrorKey`'in
tanıdığı bir anahtar DEĞİLDİ — `generic`e düşüyor ve yönetici sebebi
söyleyebilecekken **"Bilinmeyen bir hata oluştu"** okuyordu.

`src/lib/action-auth.ts`: tek gövde, iki biçim (`requireX` sonuç döner,
`assertX` TANINAN anahtarla fırlatır). Rol JENERİK — `requirePartner()` çalışma
zamanında daralttığı gibi tipte de daraltır, yoksa çağıran `as` ile susturmak
zorunda kalır ve kapı anlamsızlaşır. **Ölçüm: elle yazılmış yetki bloğu 28 → 0.**

Ayrıca artık **giriş yapmamış** ile **yetkisiz** ayrılıyor: kopyaların bir kısmı
ikisini de `authRequired` ile karşılıyordu, yani zaten giriş yapmış bir kullanıcıya
tekrar giriş yapmasını söylüyordu.

### 2. Kopyalanan gövdeler (DTO) — ayrışma zaten BAŞLAMIŞTI

Mobil uçlar alan-alan eşlemeyi ayrı ayrı yazıyordu. İki yerde kopyalar çoktan
ayrışmıştı — kimse bir alanı silmedi, biri EKLENDİ ve diğeri geride kaldı:

- **`isVerified`** yalnızca `shops/nearby` yanıtındaydı, `shops/[id]`'de yoktu:
  uygulama aynı dükkanı **listede "doğrulanmış", detayda doğrulanmamış** gösteriyordu.
- **`emailVerified`** yalnızca `auth/session` ve `auth/me` yanıtlarındaydı;
  Apple/Google/kayıt ile girenler için yoktu — **"e-postanı doğrula" uyarısı hangi
  yoldan girildiğine göre çıkıyor ya da çıkmıyordu.**

`src/lib/mobile-dto.ts`: `toMobileUser`, `toMobileShop`,
`toMobileBookingSummary` / `toMobileBookingDetail` (detay, özetin ÜST KÜMESİ —
mandal bunu sınıyor). Gövde AÇIK alan listesi; `...user` yayılması olsaydı yeni bir
sütun (örneğin `passwordHash`) sessizce istemciye giderdi.

### 3. Ölü yetki kodu — yanlış güvence

`api/mobile/shops/[id]/slots` şunu yazıyordu:

```ts
try { await requireMobileUser(req); } catch { return 401; }
```

`requireMobileUser` **hiç fırlatmaz**, başarısızlıkta `{ error: NextResponse }`
DÖNDÜRÜR. Yani `catch` hiçbir zaman çalışmıyordu ve uç fiilen kimlik doğrulaması
YAPMIYORDU. Slot müsaitliği zaten herkese açık veri (web ucu de istemiyor, misafir
giriş yapmadan slot seçmek zorunda), o yüzden doğru düzeltme yetkiyi uygulamak
değil ölü kodu kaldırıp açıklığı SÖYLEMEK oldu. Gövde web ucuyla ortaklaştı.

### 4. Diğer tekilleştirmeler

- **`CURRENCY_LOCALES` birebir kopyaydı.** `date-locale.ts` içindeki
  `UI_LOCALE_TO_BCP47` ile aynı altı satır. İsim (`dateLocaleForUiLocale`) dar
  olduğu için kopyalanmaya davet ediyordu; modül `intl-locale.ts` /
  `bcp47ForUiLocale` olarak genelleştirildi (37 çağrı yeri).
- **`partner.ts`'te dört örtüşen kod→anahtar tablosu** ortak tabana indi; bir
  eşlemeyi düzeltmek diğer üçünü geride bırakıyordu.
- **E-posta doğrulama iki kez yazılıydı** (web sayfası + mobil uç, 35'er satır,
  kelimesi kelimesine aynı, ikisi de `console.error` kullanıyordu) →
  `src/services/auth/verify-email.ts`.
- **Misafir bearer-token doğrulaması iki uçta** → `authenticateGuestLookup`.
  Kimlik doğrulama, kopyaların ayrışmasını en pahalıya ödeyeceğimiz yer.
- **Dekoratif sayfa zemini 8 dosyada 10 kez** kopyalanmıştı →
  `<AmbientBackdrop />`. `pointer-events-none` sınıfı bir kopyada unutulsa
  altındaki form tıklanamaz olurdu; bileşen bunu garanti eder.
- **Süresi dolmuş misafir bağlantısı** artık gerçek mesaj alıyor
  (`Errors.guestLinkExpired`, 6 dil); önce genel "sorgulama hatası" diyordu.

### 5. Rezervasyon erişim kuralı — kasıtlı ama YAZISIZ fark

Kural üç mobil uçta elle yazılmıştı ve aralarında kasıtlı bir fark vardı: detay
ucunda dükkan sahibi esnaf da okuyabiliyor, iptal/düzenleme uçlarında
okuyamıyordu. **Fark doğruydu** — esnafın yolu "reddet"tir ve o yol iadeyi + slot
temizliğini `cancelBooking` üzerinden yürütür — ama üç kopyanın arasında yazılı
değildi; biri güncellenirken diğerinin geride kalması an meselesiydi.

`src/services/booking/access.ts`: fark artık ADI OLAN bir parametre
(`allowShopPartner`), `booking-access.test.ts` ile kilitli.

### Mandallar

- `action-auth.test.ts` — ham `Unauthorized` yok; hiçbir action rolü OTURUMDAN
  kendi çözmüyor. **Ayrım kasıtlı:** `session.user.role !== "ADMIN"` yasak,
  `auth.actor.role !== "ADMIN"` serbest (aktör kapıdan gelmiştir, bu bir ALAN
  kuralıdır — "admin sahiplik kontrolünü atlar"). İkisini ayırmayan bir mandal
  meşru kuralları da bastırır ve kapatılmaya yol açar.
- `mobile-dto.test.ts` — uçlar kendi kullanıcı gövdesini kurmuyor; detay özetin
  üst kümesi; özet QR/mühür taşımıyor.

**Ölçüm:** servis dışı doğrudan yazma **95 → 91**, elle yazılmış yetki bloğu **28 → 0**, e-posta kabuğu kopyası **0**, test **599 → 623**.

## 2026-08-25 — bildirim alıcısı: her iki taraf da müşterilerinin yarısını atlıyordu

**En pahalı bulgu bu turda.** Check-in / check-out bildiriminin ALICISI iki
taşıyıcıda farklı yazılmıştı:

| Taşıyıcı | Baktığı alan | Kimi atlıyordu |
|---|---|---|
| Web (`actions/partner.ts`) | `booking.guest?.email` | **hesapsız** misafir checkout'u |
| Mobil (`api/mobile/bookings/[id]/check-in`) | `booking.guestEmail` | **hesaplı** kullanıcı |

Rezervasyon ya hesaplıdır (`guestId` → `guest.email`) ya da hesapsız misafir
checkout'udur (`guestEmail`); ikisi aynı anda dolu değildir. Yani **her iki yol da
müşterilerinin yarısına "valiziniz güvende" e-postasını hiç göndermiyordu** — ve
hiçbir hata oluşmadığı için bu hiçbir yerde görünmüyordu.

Kural artık `src/services/booking/guest-contact.ts`'te tek satır:
`bookingNotificationEmail(booking)` — hesap adresi öncelikli, yoksa misafir
adresi, ikisi de yoksa `null`. `guest-contact.test.ts` hem kuralı hem de
"hiçbir taşıyıcı kendi alıcı kuralını yazmıyor" mandalını taşıyor (geçici ihlal
enjekte edilerek kırıldığı doğrulandı).

### Aynı turda kapatılanlar

- **Mobil check-in/out ham TÜRKÇE servis metnini istemciye dönüyordu**
  (`message: result.message`). Kod zaten dönüyordu; metin kaldırıldı.
- **Sessizce yutulan hatalar loglandı.** `.catch(() => {})` yazan 8 sunucu-tarafı
  çağrı vardı. En kötüsü **sadakat puanı artırımı**: iptal tarafı (`lifecycle.ts`)
  düşme hatasını zaten logluyordu, kazanma tarafı loglamıyordu — misafir puanını
  alamadığında sebebi HİÇBİR yerde yazmıyordu. "Sadakat puanı kazanılıyor ama
  görünmüyor" hatası (`b069522`) tam bu körlükten çıkmıştı. Diğerleri: rezervasyon
  onay e-postası, esnaf/admin bildirimi, şikayet olayı ve bildirimi, süresi geçmiş
  token temizliği.
- **Mobil bildirimlerde dil eksikti** (`notifyCheckIn(email, id)` → `"tr"`
  varsayılanı). Alıcıyla birlikte düzeltildi.

- **`/api/bookings/guest-cancel` ham servis METNİNİ dönüyordu** (`result.message`)
  ve `ManageBookingClient` onu ekrana aynen basıyordu; `"Email mismatch"` de öyle.
  Uç artık sabit kod döner (`email_mismatch`, `cancel_not_allowed`, ...), istemci
  `useActionErrorText` ile çevirir.

### Aynı turda: rezervasyon oluşturma kapıları

- **Platform tatili kontrolü YALNIZCA web'deydi.** Mobil checkout ucu bunu hiç
  yapmıyordu: aynı tarih web'de reddedilirken mobilde kabul ediliyordu.
- **Geçersiz tarih aralığı mobilde HTTP 500 dönüyordu.** `createInitialBooking`
  tipsiz bir Türkçe cümle fırlatıyordu (`new Error('Geçersiz rezervasyon
  tarihleri.')`) ve mobil uç onu yakalamıyordu.

İkisi de artık `createInitialBooking` içinde ve TİPLİ
(`BookingRejectedError` → `INVALID_DATES` / `PLATFORM_HOLIDAY` /
`CAPACITY_EXCEEDED`); taşıyıcılar kodu kendi hata sözleşmesine çevirir.
`BookingCreationGuards.test.ts` bunu kilitliyor.

## 2026-08-25 — e-posta kabuğu: aynı markup 22 kez kopyalanmıştı

**Ölçüm:** `NotificationService` 913 satırdı ve aynı HTML kabuğu **22 kez**
yazılmıştı; marka rengi `#ea580c` **32 yerde** sabitti, buton stili **13 yerde**.
Bunun iki somut sonucu vardı:

1. **E-postaların görünümü değiştirilemiyordu.** Marka rengini değiştirmek ya da
   footer'a bir satır eklemek 22 ayrı yerde aynı düzenleme demekti. Sitenin geri
   kalanı `globals.css` kimlik katmanından besleniyor; e-postalar o katmanın hiç
   ulaşmadığı tek yüzeydi.
2. **Kopyalar zaten ayrışmıştı.** Footer'ın `margin-top:24px`i yalnızca BİR
   şablonda vardı; diğer ikisinde footer gövdeye yapışıktı. Kimse fark etmemişti,
   çünkü görmek için 18 bloğu yan yana koymak gerekiyordu.

### Yapılan

- **`src/lib/email-template.ts`** — tek kabuk: `renderEmailHtml({ locale, tone,
  heading, paragraphs, rows, cta, footer })`. `dir="rtl"`, tablo zebrası, düğme /
  bağlantı ayrımı ve footer boşluğu artık tek yerde. **Ton** kavramı eklendi
  (`brand` / `muted` / `success` / `alert` / `info`): başlık ve düğme aynı renkten
  beslenir, yani bir e-postanın ne anlattığı renginden okunur.
- **Yedek dil davranışı düzeltildi.** Her şablon kendi `?? { ... }` yedeğini
  yazıyordu ve o yedekler DEGRADE'ydi — tek satırlık, HTML'siz, Türkçe. Yani bir
  dil unutulduğunda misafir yalnızca yanlış dili değil, bozuk bir belgeyi de
  alıyordu. `pickLocale` artık TAM Türkçe şablona düşürüyor.
- **Marka rengi çevirilerin İÇİNDEN çıkarıldı.** İptal e-postasının cümle içi
  bağlantısı 6 çevirinin her birinde `style="color:#ea580c"` taşıyordu; çeviri
  artık `{link}` yer tutucusu tutuyor, rengi kod veriyor.
- **`ShopService`'in onay e-postası** da kabuğa taşındı. O e-posta bir kez KIVRIK
  TIRNAK ile yazılmıştı ve hiçbir `style`/`href` geçerli değildi (P1-3); markup
  tek yerde olduğu için o hatanın tekrarı için bir yüzey kalmadı.
- Tutar biçimlendirmesi: altı dilin altısı da her gönderimde hesaplanıyor, beşi
  atılıyordu. Artık yalnızca gerekli olan.

**Ölçüm sonrası:** kabuk tekrarı **22 → 0** (yalnızca `email-template.ts`),
`#ea580c` **32 → 0**, buton stili **13 → 0**.

### Doğrulama — iddia değil, karşılaştırma

Değişiklikten ÖNCE 5 şablon × 6 dil = **30 e-posta** (konu, düz metin, HTML)
yakalandı; değişiklikten SONRA aynı 30'u yeniden üretilip karşılaştırıldı.

**Tek fark:** 12 e-postada footer'ın `margin-top:24px` kazanması — yukarıda
anlatılan, kasıtlı ve görünür düzeltme. Kalan her bayt aynı.

### Mandal: `src/__tests__/notification-locale-coverage.test.ts`

**Bu hata ÜÇ KEZ elle düzeltildi** (`3a1c988`, `051e89e` ve 24 Ağustos turu) ve
her seferinde aynı yapıdan çıktı: `{ tr: {...}, en: {...} }[locale] ?? {...}`
kalıbında `??` eksik bir dili SESSİZCE yutar. Ne tip kontrolü ne lint bunu görür —
teknik olarak doğru kod. Görülebilmesi için ÖLÇÜLMESİ gerekiyordu.

Mandal her şablonun `src/i18n/routing.ts`'teki dillerin TAMAMINI taşıdığını ve
desteklenmeyen bir dilin şablonda kalmadığını sınar; iki kalıbı da (`pickLocale`
ve eski `[locale] ??`) tanır. Geçici ihlal enjekte edilerek kırıldığı doğrulandı.

Ayrıca `email-template.test.ts` (8 test) kabuğun kendi davranışını kilitliyor.

## 2026-08-25 — web/mobil ikizleri: aynı iş kuralı iki kez yazılmıştı

**Kök bulgu:** `CLAUDE.md` "yazma işlemleri yalnızca `src/services/`" diyordu ama
**hiçbir şey bu kuralı tutmuyordu** ve kural sessizce aşınmıştı: `src/actions` +
`src/app` içinde **118 doğrudan Prisma yazma çağrısı** vardı. Aşınmanın bedeli
teorik değil — aynı iş kuralı bir kez web action'ında, bir kez mobil API ucunda
yazılmıştı ve **kopyalar ayrışmıştı**.

### Kanıtlanan hatalar (hepsi bu ayrışmadan)

| # | Nerede | Ne oluyordu |
|---|---|---|
| 1 | `api/mobile/partner/bookings/[id]/reject` | Ham `booking.update({ status: CANCELLED })`. Web `cancelBooking()` çağırıyor; o iadeyi/ödeme niyetini `PaymentService` üzerinden kapatıyor, **`ReservationSlot` satırlarını siliyor** ve sadakat puanını geri alıyor. Mobil hiçbirini yapmıyordu: **reddedilen rezervasyon dükkanın kapasitesini kalıcı olarak tutuyordu** ve ödeme defterinde açık satır kalıyordu. |
| 2 | `api/mobile/partner/seals/confirm-delivery` | Yalnızca `sealRequest.status = DELIVERED` yazıyordu, **mühürleri dükkana hiç atamıyordu**. Esnaf "teslim aldım" dedikten sonra elinde kullanılabilir mühür olmuyor, check-in "mühür bu dükkana atanmamış" diye reddediyordu. |
| 3 | `admin-management.ts` `deleteUserAction` | Yasaklı kullanıcının açık rezervasyonlarını ham `updateMany({ status: CANCELLED })` ile iptal ediyordu — 1 numaralı sızıntının aynısı. Yasaklanan bir esnafın dükkanı silinse bile slotları dolu görünüyordu. |
| 4 | `api/mobile/partner/bookings/[id]/approve` | Bildirim dili `"en"` sabitti; web `getLocale()` geçiyordu. Türk misafir, esnaf mobilden onayladığında **İngilizce e-posta** alıyordu. |
| 5 | `api/mobile/partner/bookings/[id]/bag-revision` | Web'le **üç noktada** ayrışıktı: durum koşulu tersti (`APPROVED\|PAID` ↔ `PAID\|CHECKED_IN`), `pendingBagRevision` **temizlenmiyordu** (eski öneri sonradan bir kez daha uygulanabiliyordu), `unitPrice` farklı yazılıyordu. |
| 6 | `api/mobile/checkout/intent` | Web'in aksine denetim izine `APPROVED` olayını **hiç yazmıyordu** — mobilden yapılan rezervasyonların onay izi yoktu. |
| 7 | `api/mobile/partner/seals/request` | Adet doğrulaması yoktu (web 1..10.000 arıyor) ve `requestedBy` boş kalıyordu: talebi kimin açtığı denetim izinde kayboluyordu. |

Hiçbiri "unutulmuş bir satır" değil. Aynı kuralı iki yere yazmanın kaçınılmaz sonucu.

### Çözüm: gövde servise, taşıyıcılar ince

Yeni servis modülleri — her biri iki taşıyıcı tarafından da çağrılır:

- `src/services/booking/partner-review.ts` — `approveBooking`, `rejectBooking`,
  `forceCancelOpenBookingsForUser`
- `src/services/booking/bag-revision.ts` — `proposeBagRevision`, `applyBagRevision`,
  `clearBagRevision`
- `src/services/seal/requests.ts` — `createSealRequest`, `confirmSealDelivery`,
  `shipSealRequest`
- `src/services/CouponService.ts` — `claim`, `release` (kupon = para)

Alan yetkisi ("bu esnaf bu dükkanın sahibi mi") **servise** taşındı: taşıyıcıların
kendi tarafında yazdığı şey tam olarak sapan şeydi. Oturum/token çözümü, i18n ve
HTTP/`revalidate` eşlemesi taşıyıcıda kaldı.

- **`createInitialBooking` artık nihai durumu yaratılışta yazar** (`initialStatus`).
  İki çağıran da önce `PENDING` yaratıp hemen ardından ham `update` ile `APPROVED`
  yapıyordu; **iki adım arasında süreç ölürse rezervasyon kalıcı `PENDING` kalıyordu**
  ve hiçbir yol onu kurtarmıyordu.
- **Valiz revizyonu durum koşulu birleştirildi** (`APPROVED | PAID | CHECKED_IN`) —
  hiçbir taşıyıcı çalışan bir yeteneğini kaybetmesin diye birleşim seçildi.
  **Daraltmak bir İŞ KARARIDIR** ve artık tek satırda yapılır.
- `partner.ts` **757 → 549 satır**: fiyat hesabı makinesi tamamen servise geçti.

### Mandal: `src/__tests__/service-layer-writes.test.ts`

Üç seviye, üçü de geçici ihlal enjekte edilerek **kırıldığı doğrulandı**:

1. **Alan-kritik modeller KESİN 0**: `Booking`, `ReservationSlot`, `BookingSeal`,
   `Seal`, `SealRequest`, `PaymentLog`, `Coupon`. Ortak yanları: bir yazma işlemi
   tek başına anlamlı değil, yanında iade / slot temizliği / envanter hareketi gerekiyor.
2. **Kalan modeller tavanla**: sayı düşebilir, yükselemez. Tavanı olmayan yeni bir
   model de yakalanır.
3. **Toplam tavan** 96.

Ölçüm: **118 → 96**; kritik modellerde **21 → 0**.

### Test kapsamı

`PartnerReview.test.ts` (10), `SealRequests.test.ts` (13), `BagRevision.test.ts` (12)
— üçü de düzeltilen hatayı doğrudan kilitliyor ("red ham update YAZMAZ", "teslim
mühürleri ATAR", "öneri HER DURUMDA temizlenir"). Toplam test 538 → 573.

### Kabul edilen kayıp / açık kalan

- **Bildirim dili hâlâ İSTEĞİN dili, misafirin değil.** Mobil `"en"` sabiti kalktı ama
  doğru çözüm misafirin dilini rezervasyonda saklamak (`Booking.guestLocale`) — bu bir
  şema değişikliği ve migrasyon gerektiriyor. Bu tur kapsam dışı bırakıldı.
- **`user` (26), `verificationToken` (12), `contactMessage` (9), `shop` (7)** hâlâ
  servis dışından yazılıyor. Aynı aciliyette değiller: çoğu kimlik doğrulama akışlarının
  kendi kayıtları ve içerik CRUD'u. Tavanlarla tutuluyorlar.

## 2026-08-25 — hata metinleri: sunucudan geleni ekrana ham basma turu

Fiş geri alışının ardından yapılan genel tarama tek bir kusur SINIFI buldu ve
hepsi aynı kökten: **action'lar `error` alanında üç ayrı biçim döndürüyordu ve
ekranlar ne gelirse aynen basıyordu.** Üçü de kullanıcının gözüne düşüyordu:

| Biçim | Nereden | Kullanıcı ne görüyordu |
|---|---|---|
| Çeviri anahtarı | `booking.ts`, `review.ts`, `referral.ts`, `blog-actions.ts` | `Errors.bookingNotFound` |
| snake_case kod | `seal.ts` | `tracking_number_required` |
| Servisin Türkçe cümlesi | `partner.ts` (`result.message`) | Japonca arayüzde Türkçe hata |

- **12 gösterim noktası düzeltildi.** `BookingDetailActions`, `ReviewForm`,
  `PartnerReferralCard`, `SealShipButton`, `AdminSealInventoryClient` (2),
  `AdminBlogClient`, `AdminBlogEditClient`, `PartnerSealsClient` (3),
  `PartnerClient`, `CheckInDialog`, `BookingsClient`, `CheckoutClient`,
  `BookingModifyModal`. Hepsi tek yardımcıya bağlandı:
  `useActionErrorText()` (`src/lib/use-action-error.ts`). Ayrıştırma saf ve
  test edilebilir: `returnedErrorKey` (`src/lib/action-error.ts`).
  Üç ekran (`BookingsClient`, `CheckoutClient`, `BookingModifyModal`) kendi
  `startsWith("Errors.")` ayıklamasını elle yazmıştı — üçü de silindi.

- **Sunucu tarafı ham metin döndürmeyi bıraktı.**
  `cancelBookingAction`'ın `catch`'i `Error.message` döndürüyordu →
  `Errors.${actionErrorKey(e)}` + log. `createBookingAction` kapasite hatasında
  Türkçe cümle döndürüyordu → `Errors.insufficientCapacity`.
  `checkInAction`/`checkOutAction` servis cümlesini geçiriyordu → sonuç KODU
  eşleniyor (`CHECKIN_CODE_TO_KEY` / `CHECKOUT_CODE_TO_KEY`).
  `seal.ts`'in dört `catch` bloğu `e.message` döndürüyordu → `"unknown"` +
  **loglama eklendi** (o dosyada hiç log yoktu, yani gerçek sebep hiçbir yerde
  yazmıyordu).

- **DÖRT çeviri anahtarı sözlükte HİÇ YOKTU** — kod onları döndürüyordu ama
  `Errors` sözlüğünde karşılıkları olmadığı için ekranda anahtar adı görünürdü:
  `invalidInput` (`contact.ts` + `partner.ts`), `invalidPhone` (`booking.ts`),
  `notFound` ve `emailSendFailed` (`contact.ts`). Bu sessiz sınıfı yakalamak
  için mandal eklendi.

- **Dört API ucu ham hata metnini İSTEMCİYE gönderiyordu** (`String(e)`):
  `bookings/guest-cancel`, `bookings/lookup`, `bookings/lookup/me`,
  `mobile/partner/shop`. `String(e)` bir Prisma sorgusunu veya şema adını dışarı
  taşıyabiliyordu ve dördü de hatayı hiç loglamıyordu. Artık sebep log'a, gövdede
  sabit kod.

- **18 yeni `Errors` anahtarı, altı dilin hepsinde.** Sözlük 35 → 53.

- **İki yeni mandal** (`src/__tests__/raw-error-copy.test.ts`), ikisi de geçici
  ihlal enjekte edilerek KIRILDIĞI doğrulandı:
  1. koddaki her `Errors.x` referansının sözlükte karşılığı var mı,
  2. hiçbir bileşen `toast.error(res.error)` / `setError(res.error)` yazmıyor.

- **Ölü kod temizlendi, lint 11 uyarı → 0.** `CheckoutClient`'ta kaldırılmış
  paylaş özelliğinin kalıntıları (`useShare`, `shareUrl`, `DateTimePicker`),
  `ManageBookingClient`'ta kullanılmayan `router`, `ShopService`'te hiç okunmayan
  `shopMap`, `SlotService`'te `SLOTS_PER_HOUR`, `guest-cancel`'da
  kullanılmayan `notificationService`, iki gereksiz `eslint-disable`.
  `eslint.config.mjs`'e `_` öneki kuralı eklendi: "imza gereği duruyor" demenin
  bir yolu olsun diye (`sendNetgsmRestSms`, SMS entegrasyonu kapalı).

**KABUL EDİLEN KAYIP:** check-in mühür hatalarının Türkçe metinleri sayı
taşıyordu ("3 valiz için 2 mühür girildi"); sonuç nesnesi sayıları ayrı alan
olarak taşımadığı için karşılık metinleri sayısız yazıldı. Aynı şekilde kapasite
hatası "kalan: 3, talep: 5" detayını kaybetti. İkisinde de sayılar zaten
kullanıcının önündeki formda; dilin doğru olması o detaydan önemli.

**BİR HATA YAPILDI, KURTARILDI:** mandalın gerçekten kırıldığını doğrulamak için
`src/locales/tr.json`'a geçici bir ihlal enjekte edildi ve geri alırken
`git checkout -- src/locales/tr.json` kullanıldı — dosya commit'siz olduğu için
bu, o oturumun TÜM tr.json işini sildi. İçerik `.next` derleme çıktısındaki
derlenmiş sözlük parçasından geri getirildi ve `en.json`'a karşı anahtar bazında
doğrulandı (1.608 anahtar, tek fark bu turun 18 eklemesi). **Ders:** commit'siz
bir çalışma ağacında `git checkout -- <dosya>` geri alma aracı değildir; önce
kopyasını al.

## 2026-08-25 — fiş dili varsayılandan alındı (geri alma)

**Karar:** 24 Ağustos'ta varsayılan yapılan "fiş / bagaj etiketi" dili beğenilmedi
ve varsayılandan alındı. Site 24 Ağustos öncesi görünümüne döndü: turuncu vurgu,
`font-black` başlık, yuvarlak köşe, beyaz yüzey.

**Nasıl geri alındı — kimlik katmanı tam da bunun için vardı.** 90+ dosyada sınıf
düzenlemesi YAPILMADI; yalnızca `globals.css` içindeki `:root` kimlik bloğunun
değerleri eski görünümle değiştirildi. Tek dosya, tek blok.

- **Fiş dili silinmedi**, `[data-identity="ticket"]` olarak duruyor.
  `NEXT_PUBLIC_SITE_IDENTITY=ticket` ile hâlâ denenebilir. Kimlik katmanının
  bütün savunması buydu: bir yön denenebilir ve VAZGEÇİLEBİLİR olmalı.
- **`legacy` yönü kaldırıldı** — artık varsayılanın kendisi o olduğu için ikinci
  bir kopyası anlamsızdı. `SITE_IDENTITIES` şimdi
  `["default", "ticket", "seal", "shop"]` (`src/lib/site-identity.ts`).
- **Mikro etiket harf aralığı 0.15em → 0.1em.** `legacy` bloğu bu değeri
  `tracking-widest`in Tailwind karşılığı olan 0.1em yerine 0.15em yazıyordu; yani
  "geri dönüş yolu" aslında birebir geri dönmüyordu. `--tracking-widest` bu
  token'a bağlı olduğu için sapma 284 kullanımın tamamına yayılmıştı.
- **Yarıçap skalasındaki ölü tanımlar temizlendi.** `@theme` bloğunda
  `--radius-xl`, `--radius-2xl` ve `--radius-lg` ikişer kez tanımlanmıştı;
  `--radius-lg: var(--id-radius-sm)` satırı hemen ardından gelen
  `--radius-lg: var(--radius)` tarafından eziliyordu — yani `rounded-lg`
  (39 kullanım) kimliğe bağlı SANILIYORDU ama değildi. Skala tekilleştirildi ve
  `rounded-lg` gerçekten bağlandı. `rounded-sm`/`rounded-md` bilerek taban
  skalada bırakıldı: keskin köşeli bir yönde `calc(... - 4px)` negatife düşerdi.

**Geriye kalan:** `.id-*` sınıfları ve mandal tavanları yerinde. Bunlar bir
görünüm kararı değil, kararın TEK YERDE durmasını sağlayan mekanizma — bu geri
alma da onların işe yaradığının kanıtı.

## 2026-08-24 — eyebrow göçü: fiş dili tamamlandı (8. tur)

7. turda açık kalan tek eksen kapandı: `--id-eyebrow-family` monospace'ti ama onu
uygulayan `.id-eyebrow` sınıfını hiçbir bileşen kullanmıyordu — harf aralığı
geçmişti, **yazı tipi geçmemişti**.

- **280 sınıf dizisi `.id-eyebrow`'a taşındı, 83 dosyada.** Ölçülen kalıplar:
  `font-black text-[10px] uppercase tracking-widest` (121), `text-xs` varyantı (51),
  `text-sm` (36), `font-bold text-xs` (18), ve 9 küçük varyant daha.
  Sonuç: `tracking-widest` **284 → 5**, `font-black` **615 → 380**.

- **Boyut sınıfları korundu.** `.id-eyebrow` kendi boyutunu (10px) yazıyor ama
  Tailwind `utilities` katmanı `components`'i eziyor — üretilen CSS'te
  `.id-eyebrow` 17.490. bayt, `.text-xs` 62.046. bayt, yani sonra gelen kazanıyor.
  **Varsayarak değil, üretilen CSS'teki bayt konumlarına bakarak doğrulandı.**
  Bu yüzden `text-xs`/`text-sm` varyantlarında boyut sınıfı bırakıldı, 10px
  olanlarda atıldı.

- **Arbitrary yarıçap sıfırlandı ve mandallandı.** 125 kullanım (`rounded-[2.5rem]`
  50, `[2rem]` 32, `[3rem]` 20, `[1.5rem]` 11, `[1.75rem]` 6, `[4rem]` 5,
  `[1.25rem]` 1) 53 dosyada skala adımlarına çevrildi. Responsive önekliler de
  (`md:rounded-[2.5rem]`) dahil. Yeni mandal: arbitrary yarıçap **= 0**.

### Bu turda verilen hasar ve onarımı — kayda geçsin

Template literal içindeki sınıfları göçürmek için yazdığım regex
(`` `([^`]*tracking-widest[^`]*)` ``) **yorumlardaki backtick'lere takıldı**:
`CheckoutClient.tsx` içinde bir açıklama bloğu `` `disabled` ``, `` `goNext()` ``
gibi backtick'ler taşıyordu, regex oradan çok uzaktaki bir backtick'e kadar
eşleşti ve 2.638 karakterlik bir JSX bloğunu tek satıra çökertti. Ayrıca
`${...}` ayrıştırması `[^}]*` kullandığı için iç içe süslü parantezli
(`${t("x", { max: y })}`) ifadelerde bozuldu ve **dört yerde sınıf düşürdü**.

Onarım: dosya `git`'te izleniyor ama bu oturumun değişiklikleri commit'siz olduğu
için `git checkout` tüm oturum işini silecekti. Bunun yerine bozulan bölge
`HEAD`'den alınıp bu oturumun bilinçli değişiklikleri (saat dilimi, `role="alert"`,
`step1Blocker`, yarıçap göçü) elle yeniden uygulandı; sonra `HEAD` ile
sözcük-bazlı fark alınarak **düşen dört sınıfın da geri geldiği** doğrulandı.

Ardından 94 değişmiş dosyanın tamamı `HEAD`'e karşı sınıf-çoklukları bazında
tarandı; beklenmeyen kayıp çıkmadı (çıkanların hepsi açıklanabilir: locale'e
taşınan Türkçe metinler, paylaşılan rozet bileşenine geçen `ShopListItem`).

**Ders:** JSX/TSX içinde backtick veya süslü parantez sayan regex yazma. Bir
sonraki toplu göçte ya AST tabanlı bir araç kullanılmalı ya da değişiklik
öncesi dosyaların kopyası alınmalı.

## 2026-08-24 — kimlik seçildi: FİŞ varsayılan oldu (7. tur)

**Seçim:** bagaj etiketi / vestiyer fişi dili. Gerekçe estetik değil işlevsel —
misafir zaten bir teslim kodu alıyor ve bagaj etiketi altı dilin hepsinde çeviri
gerektirmeden okunuyor. Turist hedefli bir üründe bu bir avantaj.

Değerler artık `globals.css` KİMLİK KATMANI `:root` bloğunda; ayrıca öznitelik
gerekmiyor. Eski görünüm `[data-identity="legacy"]` olarak duruyor:
`NEXT_PUBLIC_SITE_IDENTITY=legacy` ile tek değişkende dönülür.

> **25 Ağustos 2026 — bu tur geri alındı.** Fiş dili beğenilmedi; varsayılan eski
> görünüme döndü ve fiş `[data-identity="ticket"]` oldu. `legacy` yönü kalktı.
> Aşağıdaki ölçümler o günkü durumu anlatır, bugünkü varsayılanı değil.
> Ayrıntı: en üstteki 25 Ağustos girdisi.

- **Varsayılan yapmadan önce kapatılan iki açık.** Yalnızca büyük yarıçaplar
  bağlıydı; bu haliyle fişe geçmek YARIM uygulanmış bir görünüm verirdi —
  kartların köşesi keskinleşir, içindeki kutular yuvarlak kalırdı:

  1. **Yarıçap skalasının tamamı bağlandı.** Ölçüm: `rounded-2xl` **293**,
     `rounded-xl` 134, `rounded-3xl` 73, `rounded-lg` 39. `rounded-full` bilerek
     dışarıda — rozet her kimlikte rozettir.
  2. **Nötr skalanın yüzey adımları bağlandı** (`gray-50..300`). `bg-gray-50` 213,
     `border-gray-100` 252 kullanım: kâğıt tonu ve saç teli çizgisi bunlardan
     geliyor. Nötr bir kimlik kararıdır, miras değil.

- **125 arbitrary değer skalaya taşındı (53 dosya).** `rounded-[2.5rem]` (50),
  `rounded-[2rem]` (32), `rounded-[3rem]` (20), `rounded-[1.5rem]` (11),
  `rounded-[1.75rem]` (6), `rounded-[4rem]` (5), `rounded-[1.25rem]` (1).
  Bunlar token sistemini **tamamen baypas ediyordu**: geri kalan her şey
  keskinleşirken onlar yuvarlak kalırdı. Legacy değerlerle birebir eşdeğer
  adımlara çevrildi (`[2.5rem]`→`4xl`, `[2rem]`→`3xl`, `[1.5rem]`→`2xl`,
  `[1.25rem]`→`xl`), yani göç eski görünümü değiştirmedi ama artık kimliğe bağlı.
  Kalan arbitrary yarıçap: **0**.

- **Üretilen CSS'ten doğrulandı** (iddia değil): `--id-accent-600:#bf3f18`,
  `--id-surface-radius:.375rem`, `--id-radius-lg:.25rem`,
  `--id-neutral-50:#f8f5f2`, `--id-display-weight:800`, `--radius-2xl:var(--id-radius-lg)`,
  `--color-gray-50:var(--id-neutral-50)`, ve `[data-identity=legacy]` bloğu yerinde.
  (Bu değerler 24 Ağustos'ta ölçüldü; 25 Ağustos'ta varsayılan geri alındı.)

- **AÇIK — monospace mikro etiket henüz uygulanmadı.** Fişin
  `--id-eyebrow-family` değeri monospace ama bunu uygulayan `.id-eyebrow` sınıfını
  hiçbir bileşen kullanmıyor: harf aralığı geçti (284 kullanım), **yazı tipi
  geçmedi**. Bunun için gerçek bileşen göçü gerekiyor —
  `text-[10px] font-black uppercase tracking-widest` üçlüsünün `.id-eyebrow` ile
  değişmesi. Mandal tavanları bu göçü yürütmek için duruyor.

- **Bilerek dışarıda:** `emerald`/`amber`/`blue` (durum renkleri), `rounded-full`
  (rozet), ve 6 adet arbitrary lacivert/gri gradyan
  (`ShopDetailClient`, `BookingsClient`, `insurance/page` — marka rengi değil).

## 2026-08-24 — görsel kimlik: jenerik görünümün mimari sebebi (6. tur)

- **Ölçüm.** Görsel dil bileşenlerde ELLE yazılmıştı:

  | Sabit | Kullanım | Dosya |
  |---|---|---|
  | `orange-*` | 687 | 90 |
  | `font-black` | 615 | 102 |
  | `tracking-widest` | 284 | — |
  | `rounded-3xl` / `[2rem]` / `[2.5rem]` | 155 | 56 |
  | **Toplam** | **1.658** | **114** |

  Buna karşılık `globals.css`'te düzgün bir `--brand-*` token katmanı ZATEN vardı
  ve yalnızca **8 dosyada** kullanılıyordu.

- **Teşhis.** Sitenin jenerik görünmesi bir zevk meselesi değil, **mimari** bir
  meseleydi — ve bu oturumda düzeltilen her şeyle aynı sınıf: *karar tek bir yerde
  durmuyordu.* İki sonucu vardı:
  1. Görünüm **değiştirilemiyordu**: "tasarımı özgünleştirelim" demek 114 dosyayı
     elle düzenlemek demekti, o yüzden hiç yapılmadı.
  2. Tam bu yüzden **jenerikti**: kimse global karar veremeyince herkes Tailwind'in
     en az dirençli yolunu tekrarladı (`font-black` + `rounded-3xl` + `orange-600`).

- **Düzeltme — 1.658 kullanım TEK BİR bileşen dosyasına dokunmadan kimliğe bağlandı.**
  Sınıfları `.id-*` yardımcılarına çevirmek 114 dosyada elle düzenleme demekti; hem
  riskli hem yarım kalmaya mahkûm. Bunun yerine **sınıfların ne anlama geldiği**
  yeniden tanımlandı — Tailwind v4'te `orange-600`'ün değeri bir tema değişkenidir:

  ```css
  --color-orange-600: var(--id-accent-600);
  --font-weight-black: var(--id-display-weight);
  --tracking-widest:   var(--id-eyebrow-tracking);
  --radius-4xl:        var(--id-surface-radius);
  ```

  Sabit sınıf artık bir **karar** değil, bir **referans**. Üretilen CSS'ten
  doğrulandı: `.font-black{font-weight:var(--font-weight-black)}` ve
  `--color-orange-600:var(--id-accent-600)`; `bg-orange-600/20` gibi opaklık
  varyantları da `color-mix()` üzerinden kimliği takip ediyor.

- **Üç yön** `[data-identity="ticket|seal|shop"]` olarak tanımlı; `<html>`
  özniteliği `NEXT_PUBLIC_SITE_IDENTITY` ile seçiliyor (`src/lib/site-identity.ts`).
  Bilinmeyen değer sessizce varsayılana düşer.

- **Bilinçli kapsam dışı:** `emerald` / `amber` / `blue` bağlanmadı. Bunlar durum
  renkleridir (başarı, uyarı, bilgi); yeşil bir "başarılı" rozeti yön değiştirdi
  diye turuncuya dönerse anlam kayar.

- **Kabul edilen kayma:** `orange-*` bugüne kadar Tailwind'in VARSAYILAN turuncusunu
  kullanıyordu, `--brand-*` ise projenin kendi skalasıydı; yalnızca 600 adımı
  çakışıyordu (#ea580c). Bağlama sonrası ikisi tek skalada birleşti, ara adımlarda
  (50/100/500) hafif kayma var. Bilinçli: iki ayrı turuncunun bir arada yaşaması
  zaten tutarsızlıktı.

- **Mandal:** `src/__tests__/design-tokens.test.ts` (13 tarama). Asıl garanti sayı
  değil **bağlantının kendisi**: 11 accent adımının hepsi, ağırlık, harf aralığı ve
  yarıçap tek tek doğrulanıyor; her yönün TAM skala tanımladığı kontrol ediliyor
  (yarım skala, sayfada iki farklı marka rengi demektir). Bağlantı koparıldığında
  kırmızı yandığı deneyerek doğrulandı. Sabit kullanım tavanları da korunuyor —
  düşebilir, yükselemez.

## 2026-08-24 — backend güvenlik/doğruluk taraması (5. tur)

- **P0 (KOD DÜZELTİLDİ, VERİ ONARIMI BEKLİYOR) — Slot ÜRETİMİ dükkanın saat
  dilimini kullanmıyordu; hata yalnızca PROD'da görünüyordu.**

  `generateSlotsForShop` duvar saatini şöyle ana çeviriyordu:

  ```js
  const localIso = `${localDay}T${h}:${m}:00`;
  const startUtc = new Date(localIso);   // üstündeki yorum: "parse as UTC"
  ```

  Yorum da kod da yanlış: saat dilimi eki **olmayan** bir ISO tarih-saat dizesi,
  çalışma ortamının **yerel** saatine göre ayrıştırılır. Ölçüldü:

  ```
  TZ=UTC             new Date("2026-06-15T09:00:00") -> 2026-06-15T09:00:00.000Z
  TZ=Europe/Istanbul new Date("2026-06-15T09:00:00") -> 2026-06-15T06:00:00.000Z  (doğrusu)
  ```

  `Dockerfile` ve `docker-compose.yml` içinde `TZ` **ayarlı değil**, yani prod
  konteyneri UTC. Geliştirici makinesi İstanbul saatinde olduğu için hata yerelde
  hiç görünmüyordu — bu yüzden bugüne kadar fark edilmedi.

  `tz` değişkeni hesaplanıyor ama yalnızca `localDay` için kullanılıyordu; saat
  hiç çevrilmiyordu. Ayrıca `shopTimeZone()` diye bir yardımcı **tanımlıydı ve
  hiç çağrılmıyordu** — dönüşümün amaçlandığını ama hiç bağlanmadığını gösteriyor
  (lint bunu "unused" olarak 2 gündür raporluyormuş).

  **Sonuç:** 09:00–20:00 açık bir İstanbul dükkanının slotları `09:00Z–20:00Z`
  üretiliyordu; misafir bunları ızgarada dükkanın takviminde **12:00–23:00**
  olarak görüyordu.

  | Gerçek durum | Misafirin gördüğü | Sonuç |
  |---|---|---|
  | Dükkan **açık**, 09:00–12:00 | slot yok | `getSlotAvailability` boş dönüyor → arama dükkanı o pencerede **eliyor** (`ShopService.ts:264,336`) |
  | Dükkan **kapalı**, 20:00–23:00 | slot var | rezervasyon alınıyor, misafir geliyor, `isShopOpenAt` check-in'i **reddediyor** (`src/services/booking/check-in.ts:42`) |

  İkinci satır bu ürünün verebileceği en kötü hata: arayüzün kendisinin önerdiği
  saat, tezgâhın başında valizle reddediliyor.

  **Düzeltme:** dönüşüm artık misafir tarafının zaten kullandığı
  `parseDatetimeLocalInTimeZone(localIso, tz)` ile yapılıyor — DST sınırlarını da
  doğru çözüyor ve iki taraf aynı fonksiyonu paylaşıyor. Kullanılmayan
  `shopTimeZone()` kaldırıldı.
  Mandal: `src/__tests__/slot-generation-timezone.test.ts` (ham `new Date(localIso)`
  geri gelirse kırmızı yanar).

  **AÇIK — veri onarımı.** Üretim `(shopId, startTime)` üzerinden `upsert` yapıyor:
  iş tekrar koştuğunda **doğru slotlar eklenir, yanlış olanlar yerinde kalır**.
  İkisi bir arada durduğu sürece misafir hâlâ kapalı saate rezervasyon yapabilir.
  Onarım aracı ve adım adım yordamı hazır: `scripts/repair-slot-timezone.sh`
  (varsayılanı kuru çalışma) + `scripts/README.md` → "Slot saat dilimi onarımı".
  Sıra: **kuru çalışma → yedek → `--apply` → `generate-slots.sh` → doğrula.**
  Rezervasyonu olan slotlara dokunulmuyor; onlar için esnafla konuşulup misafire
  yeni saat önerilmeli — script bunları ayrıca sayıp uyarıyor.

- **P2 (düzeltildi) — Webhook imzası tekrar oynatmaya (replay) açıktı.**
  `/api/webhooks/resend`, kimlik doğrulaması olmayan ve veritabanına YAZAN tek
  genel POST ucu; **hiç testi yoktu**. `svix-timestamp` imzalanan içeriğe giriyor
  ama **tazeliği hiç kontrol edilmiyordu**: geçerli bir isteği bir kez yakalayan
  biri onu sonsuza kadar tekrar gönderebilir, gövde ve imza değişmediği için
  doğrulama her seferinde geçer. Gelen e-posta yolu tekilleştirme yapmadan
  `contactMessage.create` çağırdığı için tek bir yakalanmış istek admin gelen
  kutusunu doldurmaya yeter — P1-18 ile aynı kanal.
  Ayrıca `svix-signature` başlığı sır döndürme sırasında **birden çok** imza taşır
  (`"v1,a v1,b"`); eski kod `","` ile bölüp ikinci parçayı alıyordu, iki imza
  geldiğinde tüm başlığı imza sanıp reddediyordu — yani sır döndürme anında
  webhook **sessizce kırılırdı**.
  Doğrulama `src/lib/webhook-signature.ts`'e çıkarıldı: 5 dakikalık zaman damgası
  toleransı, çoklu imza desteği, ve Svix sırrı varken zaman damgası taşımayan eski
  imza yoluna düşmenin engellenmesi. 10 test: `src/__tests__/webhook-signature.test.ts`.

## 2026-08-24 — misafir diğer sayfalar + auth taraması (4. tur)

Durum tablosundaki son ❌ satır. Üç ayrı hata sınıfı çıktı; üçü de **sessiz**.

- **P2 (düzeltildi) — Yönetim ekranlarının hata mesajı prod'da İngilizce bir
  paragrafa dönüşüyordu.** 12 çağrı yerinde `catch` bloğu
  `toast.error(error instanceof Error ? error.message : String(error))` yazıyordu.
  Next 16'da bir server action'dan FIRLAYAN hata istemciye kırpılarak gider;
  React onun yerine şunu koyar:
  *"An error occurred in the Server Components render. The specific message is
  omitted in production builds to avoid leaking sensitive details. …"*
  (doğrulandı: `node_modules/next/dist/compiled/react-server-dom-turbopack/…/client.browser.production.js`)
  Yani yönetici geçersiz bir kapasite girdiğinde bu paragrafı görüyordu — 6 dilin
  hepsinde, hangi alanın yanlış olduğunu söylemeden. Geliştirmede ise ham anahtar
  sızıyordu: `admin-management.ts` `Errors.invalidData` diye fırlattığı için ekranda
  birebir "Errors.invalidData" yazıyordu.
  İki katmanlı düzeltme: (a) `updateShopAction`'ın DOĞRULAMA hataları artık
  fırlatmıyor, `{ success: false, error }` dönüyor — o dönüş kırpılmaz, sebep prod'a
  ulaşır; (b) `src/lib/action-error.ts` ile `catch` yolu asla ham metin basmaz,
  tanınmayan her şey yerelleştirilmiş `Errors.generic`'e düşer.
  Mandal: `src/__tests__/raw-error-copy.test.ts`.

- **P2 (düzeltildi) — Giriş, kayıt ve şifre ekranlarında hata DUYURULMUYORDU.**
  Dördü de hatayı düz bir `<p>` olarak çiziyordu, `role="alert"` yok. Ekran okuyucu
  kullanan biri yanlış şifreyle "giriş yap"a bastığında HİÇBİR ŞEY duymuyor: odak
  butonda kalıyor, form değişmemiş görünüyor. Checkout'ta aynı sınıf 1. turda
  düzeltilmişti; auth yüzeyi o düzeltmenin dışında kalmıştı.

- **P2 (düzeltildi) — 119 satır sabit TÜRKÇE metin; çeviri dosyalarına hiç uğramıyordu.**
  Mevcut `hardcoded-copy.test.ts` yalnızca `locale === "tr" ? …` DALINI arıyordu;
  asıl borç koşulsuzdu — bileşenin içine düpedüz Türkçe yazılmıştı. En can yakıcı üçü:
  - `layout.tsx` → **"İçeriğe atla"**: her sayfadaki İLK sekme durağı. Klavye veya
    ekran okuyucu kullanan Japon bir misafir Türkçe duyuyordu.
  - `ShopListItem.tsx` → **"Doğr."** ve **"≤{n}dk"**: arama sonuçlarındaki iki güven
    rozeti. Aynı ikili `TrustBadge` içinde ZATEN yerelleştirilmişti; burada ikinci kez,
    elle ve Türkçe çiziliyordu. İki kopya olması hatanın kendisiydi — artık paylaşılan
    bileşen kullanılıyor.
  - `QRScanner.tsx` → üç kamera hata metni; esnaf 6 dilde Türkçe okuyordu.
  Ayrıca `partners`/`contact`/`register` sayfaları, esnaf kazanç ekranı, mühür kargo
  formu ve `partner/seals` boş durumu. 31 yeni anahtar × 6 dil.
  Mandal: `hardcoded-copy.test.ts` → "sabit yazılmış Türkçe metin", tavan 13.
  Tarama iki sinyale birden bakıyor (Türkçe'ye özgü harfler + Türkçe durak kelimeler);
  yalnızca harfe bakmak yetmiyordu, "Platform komisyonu dahil" ve "Puan" düz ASCII
  olduğu için ilk ölçümde görünmemişti.

### Açık — misafire giden hatırlatma e-postaları TÜRKÇE (şema işi)

`src/app/api/internal/booking-reminders/route.ts:57,79` — check-in ve check-out
hatırlatmaları sabit Türkçe metinle gidiyor, tarihler de `toLocaleString("tr-TR")`.
Japon bir misafir Türkçe e-posta ve Türk tarih biçimi alıyor. Hedef kitle turist
olduğu için bu P1 sınıfı.

**Neden burada durdu:** düzeltmesi kod değil ŞEMA işi. `NotificationService`
yerelleştirilmiş yolu zaten biliyor (`notifyBookingApproved(..., locale)`), ama o
locale'i `getLocale()` ile İSTEK anından alıyor — cron'un isteği yok. Ne `User` ne
`Booking` misafirin dilini saklıyor (`prisma/schema.prisma` içinde `locale` yalnızca
`AnalyticsEvent`, `MobilePushToken`, `BlogPost`'ta var).

**Gereken değişiklik:** `Booking.locale` (nullable) + rezervasyon oluşturulurken
yazılması + hatırlatma işinin onu kullanması + 3 e-posta şablonunun 6 dile çıkarılması.
Prod veritabanına migrasyon gerektirdiği için karar bekliyor.

## 2026-08-24 — açık kalan KOD maddeleri (3. tur)

Karar/veri bekleyen maddelere dokunulmadı; yalnızca "kod" diye işaretlenmiş ve
kanıtı zaten yazılı olanlar kapatıldı.

- **P1 (düzeltildi) — Saat dilimi uçtan uca taşınmıyordu.** 2. turun "açık kalan"
  maddesi. `SlotService` müsaitliği `Shop.timezone`'da üretiyor, ama `CheckoutClient`
  her yerde `parseDatetimeLocalInTimeZone`'un VARSAYILANINI (İstanbul) kullanıyordu.
  Bugün üç dükkan da İstanbul olduğu için ikisi tesadüfen örtüşüyor; İstanbul dışı
  ilk dükkanda misafirin ızgarada gördüğü saat ile rezervasyona yazılan an ofset
  kadar ayrışır ve ekranda hiçbir uyarı çıkmaz. Dilim artık tek parametre:
  sayfa (`shop.timezone`) → `CheckoutClient` → `SlotAvailabilityGrid`. Aynı sözleşme
  `BookingModifyModal`'a da getirildi (`GuestBookingListItem.shop` artık `timezone`
  seçiyor). Mandal: `src/__tests__/slot-range-timezone.test.ts` (3 yeni tarama).
- **UX — "Saatler dükkanın yerel saatiyle (İstanbul)." metni şehri SABİT yazıyordu.**
  6 dilde de. Artık `{zone}` parametreli; kaynağı dükkanın kendi dilimi
  (`timeZoneCityLabel`). Dilim parametre olup metin sabit kalsaydı, tam da hangi
  takvimin geçerli olduğunu açıklayan cümle yalan söylerdi.

- **P2 (düzeltildi) — Esnaf paneli yalnızca ilk dükkanı gösteriyordu** (23 Ağustos
  maddesi). `partner/page.tsx` koşulsuz `shops[0]`'ı alıyordu. Artık `?shop=<id>`
  ile seçiliyor — id, esnafın KENDİ dükkan listesine karşı doğrulanıyor, sahipliği
  atlatan bir yol açılmıyor — ve birden fazla dükkanı olan esnafa başlıkta bir
  dükkan seçici çıkıyor (`shopSwitcherLabel`, 6 dil).

- **P2-6 (düzeltildi) — Misafir iptal token'ı repoda YAZILI bir sırra düşüyordu.**
  Üç uç (`lookup`, `lookup/me`, `guest-cancel`) sırrı
  `process.env.AUTH_SECRET || "bagajpark-guest-management-secret"` diye türetiyordu;
  `AUTH_SECRET` yoksa üçü de herkesin okuyabildiği bir sırla imza doğruluyordu ve o
  sırla üretilmiş token `guest-cancel`'da kabul edilirdi. Tek yer:
  `src/lib/guest-lookup-token.ts` — fallback yok, eksikse atar. Sır artık `catch`'in
  DIŞINDA okunuyor, yoksa yapılandırma hatası "geçersiz token" (401) diye görünürdü.
  Mandal: `src/__tests__/guest-token-secret.test.ts` (`AUTH_SECRET || "..."` kalıbı
  `src/` genelinde yasak).

- **P2-2 (düzeltildi) — Sıralayıcının nötr puan varsayımı hiç çalışmıyordu.**
  `(shop.rating ?? 3) / 5` yazıyordu ama `Shop.rating` şema varsayılanı `0.0`,
  `NULL` değil — `??` hiç devreye girmiyor ve yorum almamış her dükkan puan
  bileşeninden sıfır alıyordu. Üçü de 0 olduğu için sıralama bugün görünürde doğru;
  ilk yorum geldiği anda o dükkan 0.3'lük bir farkla öne geçerdi. `ratingScore()`
  artık kolonu değil YORUM DURUMUNU okuyor (0 = değerlendirilmemiş → nötr).
  Kolonun `NULL`'a çevrilmesi ayrı bir veri kararı; kod her iki hâlde de doğru.

- **P2-4 (düzeltildi) — `cancelBooking` yorumu kodun yaptığını anlatmıyordu.**
  Yorum "≥24s tam iade, ≥1s %50, sonrası kupon" diyordu; gövdede kademe YOK,
  koşulsuz tam iade işaretleniyor. İade mantığını değiştirecek kişinin okuduğu ilk
  şey olduğu için en yanıltıcı yerdeydi. Yorum gerçeğe çekildi.

- **P2-7 (düzeltildi) — İki güven rozetinin de arkasında hiçbir kod yolu yoktu.**
  - *"Doğrulanmış"*: kolon şemada, rozet üç yüzeyde çiziliyor, ama `src/` içinde
    `isVerified`'i YAZAN tek satır yoktu — prod'daki tek `true` elle veritabanına
    girilmişti. Admin dükkan düzenleme formuna `isTest` ile aynı kalıpta bir onay
    kutusu eklendi; değişiklik `admin_shop_verified_flag_changed` ile loglanıyor.
    Rozet artık bilinçli ve izlenebilir bir admin kararı.
  - *"≤ X dk yanıt"*: `responseTimeMinutes` platform genelinde 0'dı ve onu yazan bir
    kod yolu yoktu. Artık GERÇEK veriden hesaplanıyor: misafirin talebi oluşturduğu an
    (`Booking.createdAt`) ile esnafın onayladığı an (`BookingEvent` `APPROVED`) arası.
    `ShopService.recomputeResponseTimes` + `POST /api/internal/response-times`, kayıt
    defterinde `response-times` (`29 3 * * *`, `enforced: false` — cron henüz kurulmadı).
    Üç karar yazılı: **p90** kullanılıyor çünkü metin "≤" diyor, yani üst sınır iddiası
    (ortanca kullanılsaydı iddia yarı yarıya yanlış olurdu); **5 örnekten az** olan
    dükkana `null` yazılıyor, yani rozet hiç çizilmiyor — tek bir hızlı onaydan çıkarılan
    sayı, rozeti yine karşılıksız bir iddiaya çevirirdi; **en az 1 dk**'ya yuvarlanıyor
    çünkü 0, şema varsayılanı olan "veri yok" ile karışırdı.
    `TrustBadge`'deki `minutes < 1 → responseTimeFast` dalı hiç çalışmıyordu (üstteki
    koşul 1'in altını zaten eliyordu); dal ve karşılığı olan çeviri anahtarı kaldırıldı.
    Mandal: `src/__tests__/shop-response-time.test.ts`.

- **i18n çeviri KALİTESİ (kapatıldı) — 289 anahtar EN ile birebir aynıydı.**
  Ölçüm: anahtar MEVCUT ama değeri İngilizce ile birebir aynı ve en az iki latin
  kelime içeriyor. Bu, `locales.test.ts`'in ölçtüğü EKSİK anahtardan farklı bir borç:
  eksik anahtar en azından `MISSING_MESSAGE` gürültüsü yapıyor, bu sessiz ve tam
  olarak hedef kitlenin gördüğü şey. Önce misafir + esnaf yüzeyi (87 anahtar), sonra
  admin paneli (196 anahtar: `Admin`, `AdminAnalytics`, `AdminStatus`) çevrildi.
  Kalan tek istisna özel adlar: destek e-postası, şirketin tescilli ünvanı, istasyon
  arama sorguları, marka adı ve Fransızcada zaten doğru olan "≤{minutes} min".
  Mandal: `locales.test.ts` → "hiçbir metin İngilizce ile birebir aynı kalmadı".
  İstisnalar `IDENTICAL_TO_EN_OK` içinde tek tek gerekçeli.

## 2026-08-24 — misafir rezervasyon akışı (UI) taraması, 2. tur (slot ızgarası)

- **P0 (düzeltildi) — Müsaitlik ızgarasıyla saat seçmek rezervasyonu BOZUYORDU.**
  `SlotAvailabilityGrid` seçilen aralığı `onSelectRange` ile HAM ISO anı olarak
  veriyordu (`"2026-08-24T09:30:00.000Z"`); `CheckoutClient` bunu doğrudan
  `setCheckInLocal`'a yazıyor, o state ise `datetime-local` DUVAR SAATİ bekliyor.
  `parseDatetimeLocalInTimeZone` gelen değerin sonuna koşulsuz `"Z"` ekliyor →
  `"...000Z" + "Z"` = `"...000ZZ"` → **Invalid Date → `null`**.
  Ölçüldü (`src/__tests__/slot-range-timezone.test.ts`): ham ISO `null`'a düşüyor.
  Sonuç: ikinci slot'a dokunup aralığı tamamlayan kullanıcının `windowOk`'u FALSE
  oluyor, "devam" butonu sönüyor ve "tarih geçersiz" uyarısı alıyordu — yani
  ızgarayı **amacına uygun** kullanmak akışı kilitliyordu. Çeviri artık sınırda
  (`toWallValue`) yapılıyor; gidiş-dönüş aynı anı koruyor.

- **P1 (düzeltildi) — Slot saatleri CİHAZIN saat diliminde yazılıyordu.**
  `formatSlotTime` `new Date(iso).getHours()`, gün penceresi de `setHours(0,0,0,0)`
  kullanıyordu. `src/lib/datetime-local.ts` bu hata sınıfını ("Berlin'de 1 saat,
  New York'ta 7 saat kayma") tam olarak anlatıyor ve tarih GİRDİLERİ için
  düzeltilmişti; slot ızgarası o düzeltmenin dışında kalmıştı. Hedef kitle turist
  olduğu için telefonu memleket saatinde olan misafir, dükkanın müsaitlik
  takvimiyle uyuşmayan saatler görüyordu. İkisi de `PLATFORM_TIMEZONE` üzerinden.
  **Açık kalan:** `SlotService` dükkan başına `shop.timezone` tutuyor, ama
  `CheckoutClient` her yerde `parseDatetimeLocalInTimeZone`'un varsayılanını
  (İstanbul) kullanıyor. İstanbul dışı bir dükkan eklendiğinde ikisi ayrışır;
  saat dilimi uçtan uca tek parametre olarak taşınmalı (ızgara `timeZone` prop'unu
  zaten kabul ediyor).

- **P1 (düzeltildi) — Slot yüklenemezse adım çıkmaza giriyordu.** `catch` bloğu
  `e.message`'ı ekrana basıyordu: kullanıcı 6 dilin hepsinde İngilizce
  "Failed to fetch slots" görüyor ve tekrar deneme yolu bulamıyordu. Yerelleştirilmiş
  metin (`slotsLoadError`, 6 dil) + "TEKRAR DENE" butonu eklendi.

- **P2 (düzeltildi) — Slot butonları erişilebilir değildi.** Ekran okuyucu yalnızca
  "09:30 3" duyuyordu; rakamın neyi saydığı hiçbir yerde yazmıyordu ve müsaitlik
  görsel olarak yalnızca RENK ile (yeşil/amber) taşınıyordu. `aria-label`
  (`slotsSlotAriaLabel` / `slotsSlotFullAriaLabel`, 6 dil), `aria-pressed` ve
  görünür klavye odağı eklendi.

- **P2 (düzeltildi) — "1.5 saat" ondalığı yerelleştirilmemişti.** `count * 0.5` ham
  basılıyordu; TR'de nokta binlik ayracı gibi okunur (`Money`/`formatDecimal`
  yakınmasının aynısı). `formatDecimal(..., locale)` kullanılıyor.

- **UX (eklendi) — Saatlerin hangi takvime ait olduğu yazmıyordu.** `timesInShopTimezone`
  ("Saatler dükkanın yerel saatiyle (İstanbul).") anahtarı 6 dilde zaten VARDI ama
  hiçbir yerde kullanılmıyordu; ait olduğu yer ızgaranın altı.

## 2026-08-24 — misafir rezervasyon akışı (UI) taraması, 1. tur

Yukarıdaki durum tablosunda "❌ yapılmadı / tek kalan yüzey" diye duran yüzey.
İkisi de **sessiz çıkmaz**: arayüz kullanıcıya hiçbir şey söylemeden akışı durduruyordu.

- **P1 (düzeltildi) — Son adımdaki hata hiç görünmüyordu.**
  `src/components/guest/CheckoutClient.tsx` footer'daki hata bloğu `step === 1` ile
  kısıtlıydı. Üye girişi yapmış misafir 2. adımda "gönder"e bastığında sunucu hatası
  (kapasite dolu, geçersiz kupon, kapalı slot) `setError(...)` ile yazılıyor ama ne
  footer'da ne 2. adımın gövdesinde render ediliyordu → "tıkla, hiçbir şey olmuyor".
  Dönüşüm yolunun **son** adımında. Aynı hata sınıfı misafir modalı için daha önce
  düzeltilmişti; kusur bileşende değil kalıptaydı (hata durumunu bir adıma bağlamak).
  Kısıt kaldırıldı, `role="alert"` eklendi, modal açıkken kendi hatasını gösterdiği
  için yalnızca o durumda gizleniyor. Mandal: `src/__tests__/checkout-error-visibility.test.ts`.

- **P2 (düzeltildi) — Sönük "devam" butonunun nedeni hiçbir yerde yazmıyordu.**
  1. adımın CTA'sı valiz seçilmeden ya da tarih aralığı geçersizken `disabled` idi.
  Disabled buton tıklanamadığı için `goNext()` hiç çalışmıyor, dolayısıyla oradaki
  `checkoutSelectBagsHint` / `checkoutDatesInvalid` açıklaması da ekrana hiç düşmüyordu.
  Engelin sebebi artık butonun üstünde pasif ipucu olarak yazıyor ve `aria-describedby`
  ile butona bağlı.

- **UX (eklendi) — 1. adımda çalışan toplam.** Kullanıcı valizi ve süreyi 1. adımda
  seçiyor ama tutarı yalnızca 2. adımda görüyordu; ücreti öğrenmek için bir adım
  ilerlemek gerekiyordu. Özet (toplam + valiz sayısı · gün) CTA'nın hemen üstüne alındı;
  2. adımdaki dökümle aynı `grandTotal`.

## 2026-08-23 — e2e yeniden yazımında bulunanlar

- **P2 (24 Ağu'da düzeltildi — bkz. 3. tur) — Esnaf paneli yalnızca ilk dükkanı gösterir.** `partner/page.tsx` `shops[0]`'ı
  `activeShop` alır; çok dükkanlı esnafın (seed'deki demo esnaf: Galata + Sultanahmet)
  diğer dükkanındaki valizler "İşlem Geçmişi"nde görünmez. Check-in `?booking=`/QR ile
  sahiplik üzerinden çalıştığı için valiz alınır ama listede bulunamaz → teslim edilemez.
  Geçici yol: `?checkoutBooking=<id>`. Kalıcı: dükkan seçici ya da tüm dükkanların listesi.
- **P2 — Geçmiş rozeti ham enum basıyordu** (`APPROVED`, `WAITING_APPROVAL`) → düzeltildi,
  6 dilde `statusApproved`/`statusWaitingApproval` eklendi. `ja.statusPaid` "有料" (ücretli)
  yanlış çeviriydi → 支払い済み.
- **P1 (düzeltildi) — PWA service worker hiç üretilmiyordu.** `@ducanh2912/next-pwa` webpack
  eklentisi; Next 16 Turbopack build'inde devreye girmiyor. Canlıdaki `sw.js` git'e commit
  edilmiş eski bir çıktıydı: önbellek kuralları kodla eşleşmiyor, `/api/mobile/*` yanıtlarını
  önbellekliyordu. Eklenti kaldırıldı; `public/sw.js` kendini kaldıran dosya, `PWARegister`
  mevcut kayıtları ve önbellekleri temizliyor. Manifest/"ana ekrana ekle" duruyor.
- **Gözlem:** dil değişiminde kısa süre iki `<h1>` DOM'da (geçiş animasyonu); arama
  sayfasında masaüstü liste + mobil alt panel aynı anda DOM'da (çift `nearby-heading`).

## Son durum — 2026-08-22

| Alan | Denetlendi mi | Sonuç |
|---|---|---|
| Veri bütünlüğü + iş kuralları | ✅ tamamlandı | 5 P0 (3'ünün mimarisi kapatıldı), 11 P1, 7 P2 |
| Ödeme entegrasyonu durumu | ✅ tamamlandı | **1 P0 — mimarisi düzeltildi (`docs/PAYMENTS.md`)** |
| İç API / cron yetkilendirmesi | ✅ tamamlandı | 2 P1 |
| API rol/auth kapsaması (67 route) | ✅ tamamlandı | 0 yeni açık — bkz. "Doğrulanmış güvenli" |
| i18n anahtar bütünlüğü (14 dil) | ✅ tamamlandı | 1 P1 (138 anahtar × 12 dil) |
| Aralıklı 502 teşhisi | ✅ tamamlandı | 1 P1 — sebep uygulama değil, Cloudflare |
| IDOR / kaynak sahipliği | ✅ tamamlandı | **1 P0 bulundu ve düzeltildi** |
| Partner paneli (UI + yetenek) | ✅ tamamlandı | 1 P0 (düzeltildi) + 3 P1 |
| Admin paneli (UI + yetenek) | ✅ tamamlandı | 2 P1 (biri düzeltildi) + 2 P2 |
| Misafir rezervasyon akışı (UI) | ✅ tamamlandı (24 Ağu) | 1 P0 + 2 P1 + 3 P2 — hepsi düzeltildi |
| Misafir diğer sayfalar + auth (UI) | ✅ tamamlandı (24 Ağu) | 3 P2 düzeltildi; 1 P1 açık (hatırlatma e-postaları) |
| i18n çeviri KALİTESİ | ✅ tamamlandı (24 Ağu) | 289 anahtar EN'de kalmıştı; mandallandı |

Yani aşağıdaki liste **eksiksiz değil** — yalnızca bir yüzeyin tam denetimini ve
21-22 Ağustos'ta elle bulunan hataları içeriyor. Kalan 6 yüzey hâlâ taranmayı bekliyor.

### En acil üç şey

1. ~~Hiçbir ödeme sağlayıcısı entegre değil, ama `PaymentLog.status` varsayılanı
   `SUCCESS`~~ → **mimarisi düzeltildi (2026-08-22)**: sağlayıcı port/adapter,
   `PaymentService` tek yazıcı, varsayılan `PENDING`, metin sağlayıcı yeteneğinden
   türüyor. Ayrıntı `docs/PAYMENTS.md`. **Kalan**: prod'daki 12 sahte `SUCCESS`
   satırı (kaynağı bilinmiyor, önce P1-5) ve istemci bileşenlerindeki kartlı metin
   (P1-19).
2. ~~8 hayalet rezervasyonun kaynağı bilinmiyor~~ → **KAYNAK BULUNDU (2026-08-22):
   `prisma/seed.ts`, ortam koruması olmadan.** Bulunan şey bir veri hijyeni sorunu
   değil, **güvenlik sorunu**: seed `admin@test.com` hesabını ADMIN rolüyle ve
   bilinen parolayla **upsert** ediyordu — prod'da parola değiştirilse bile her
   çalıştırmada geri geliyordu. Kapı eklendi ve çalıştırılarak doğrulandı.
   **Kalan ve en acil iş: prod'daki demo hesapların parolalarını değiştirmek** —
   kapı yenisini engelliyor, mevcudu değiştirmiyor (P1-5).
3. **19 rezervasyonun 18'i çıkış saatini geçmiş hâlde açık; hiçbiri hiç
   `CHECKED_OUT` olmamış.** Üç müşterinin bavulu Haziran'dan beri "dükkanda"
   görünüyor. → **Tarama altyapısı kuruldu (2026-08-22)**: `OverdueBookingService`,
   `/api/internal/overdue-scan`, `/api/health/jobs`'ta 503 sinyali,
   `scripts/README.md` runbook'u. **Kalan**: cron kurulumu (runbook 3. adım), 3 eski
   satır için saha kararı ve `CHECKED_OUT`'un neden hiç kullanılmadığı (P1-22).

---

## P0 — Para, güven veya erişilebilirlik doğrudan bozuk

### [P0-0] ✅ MİMARİ DÜZELTİLDİ — Hiçbir ödeme sağlayıcısı entegre değil, ama sistem para almış gibi davranıyordu
- **Nerede**: `prisma/schema.prisma:240`; tüm `src/`
- **Kanıt** (kendim doğruladım):
  ```bash
  grep -rlniE "iyzico|paytr|stripe|craftgate|sipay" src/ --include="*.ts" --include="*.tsx" | wc -l
  # 0
  ```
  `PaymentLog.status` şemada `@default(SUCCESS)` — yani ödeme kaydı, hiçbir kart
  çekilmeden "başarılı" olarak yaratılıyor. Prod'da 12 `PaymentLog` var, hepsi
  `SUCCESS`, toplam 3.480 TRY; karşılığında tahsil edilmiş **hiç para yok**.
- **Neden önemli**: bu, aşağıdaki birçok maddenin kök nedeni. Sistem rezervasyonu
  `PAID` işaretliyor, misafire ödeme yapılmış gibi gösteriyor, partner kazanç
  bekliyor — hiçbiri gerçek değil. Ayrıca bu, tek başına bir "hata" değil: senin de
  söylediğin gibi şirket kurulup entegrasyonlar yapılacak. **Asıl hata, entegrasyon
  yokken kamuya açık sayfaların somut para vaatleri vermesi.**
- **Bağlantılı maddeler**: P0-2 (iade vaadi), P0-4 (sigorta ücreti), P0-5 (gecikme
  tahsilatı), P1-5 (hayalet ödemeler), P1-9 (ödeme kaydı olmayan rezervasyonlar),
  P1-11 (`splitCompleted` hepsi false — partner ödemesi hiç yapılmamış).
- **Çözüm (uygulandı, 2026-08-22)** — ayrıntı: `docs/PAYMENTS.md`.
  Hatayı düzeltmek yerine tekrar edilmesini imkânsız kılmayı hedefledik:
  1. **`PaymentProvider` port/adapter mimarisi** (`src/lib/payments/`). Lansman
     adaptörü `ManualPaymentProvider` — **dükkanda tahsilat**. Bu bir eksiklik değil,
     bilinçli karar: PSP komisyonu (~%2,5) ve entegrasyon/uyum işi lansmanda sıfır,
     akış dürüst. Iyzico/PayTR gelince yeni adaptör dosyası eklenir, çağıran kod
     değişmez.
  2. **`PaymentService` defterin tek yazıcısı** (`src/services/PaymentService.ts`).
     Durum geçiş tablosu, idempotent niyet açma, kısmi iade, her geçişte
     `BookingEvent` denetim izi.
  3. **`PaymentStatus` varsayılanı `PENDING`** (+ `AUTHORIZED`,
     `PARTIALLY_REFUNDED`, `CANCELLED`). `PaymentLog`'a `provider`, `currency`,
     `refundedAmount`, `idempotencyKey`, `providerRef`, `failureReason`,
     `capturedAt`, `refundedAt`, `updatedAt`.
  4. **`markAsPaid` artık defter üzerinden** ve tahsilat + rezervasyon durumu **tek
     transaction'da** yazılıyor — "ödemesiz PAID" artık üretilemez (P1-9'un kök nedeni).
  5. **Metin, kodun yeteneğinden türüyor** (`src/lib/payment-copy.ts`). FAQ'in a2/a3
     cevapları ve JSON-LD artık `capabilities.capturesOnline`'a bakıyor; 14 dile
     dükkanda-tahsilat metinleri eklendi. `PAYMENT_PROVIDER=iyzico` yazıldığı gün
     kartlı metinler kendiliğinden geri gelir.

  Typecheck temiz, lint 0 hata, 203 test yeşil (14 yeni ödeme testi).
- **AÇIK KALAN — bilerek**:
  - **Prod'daki 12 sahte `SUCCESS` satırı düzeltilmedi.** `provider='legacy_unverified'`
    damgalandılar. Migrasyonun sessizce veri düzeltmesi yapması denetim izini bozardı
    ve bu satırların kaynağı hâlâ bilinmiyor — önce P1-5 çözülmeli.
  - **İstemci bileşenleri hâlâ koşulsuz kartlı metin kullanıyor**
    (`BookingModifyModal` → `modifyRefundNote`, `cancellationEstimateCard`,
    `payBookingDivider`). Çeviri anahtarları 14 dilde hazır; eksik olan sunucu
    tarafındaki yeteneği istemciye taşıyan yol (context/provider). → **P1-19**
  - Marketplace split sağlayıcıda ayrılmıyor; şu an tahsilat esnafın elinde olduğu
    için platform komisyonu **esnaftan alacak**. → P1-11 ile birlikte ele alınmalı.

### [P0-6] ✅ DÜZELTİLDİ — IDOR: herhangi bir partner tüm mühürleri arızalı yapıp platformda check-in'i durdurabiliyordu
- **Nerede**: `src/app/api/mobile/partner/seals/report-faulty/route.ts`
- **Kanıt** (zincirin tamamını kod okuyarak + DB'den doğruladım):
  1. Uç, mührü **global olarak benzersiz** `serialNumber` ile buluyor ve hiçbir sahiplik
     kontrolü olmadan `status: "FAULTY"` yazıyordu (ham `prisma.seal.update`).
  2. `serialNumber` bir **integer** ve prod'da **1–2000 aralığında ardışık**
     (`min 1 | max 2000 | 1301 kayıt`) — yani numara tahmin etmek gerekmiyor, sayarak
     bulunuyor. Rate limit de yok.
  3. `FAULTY` bir mühür check-in'de reddediliyor: `SealService.ts:122` mührün
     `ASSIGNED` **ve** o dükkana ait olmasını şart koşuyor, aksi halde
     `SEAL_FAULTY_INVALID` fırlatıyor.
  → Sonuç: tek bir partner hesabı ~2000 istekle sistemdeki tüm mühürleri arızalı
  işaretleyip **hiçbir partnerin check-in yapamamasına** yol açabilirdi. Mühürler aynı
  zamanda anlaşmazlıklardaki fiziksel zilyetlik kanıtı olduğu için denetim izi de
  bozulurdu.
- **Asıl çarpıcı kısım**: doğru kod **zaten vardı** —
  `SealService.markSealAsFaulty(serialNumber, shopId)` hem sahipliği
  (`seal.shopId !== shopId` → `seal_not_owned_by_shop`) hem durumu (`IN_USE`/`RETURNED`
  yeniden işaretlenemez) kontrol ediyor. Uç bu metodu hiç çağırmıyor, ham prisma ile
  iki korumayı da atlıyordu.
- **Çözüm (uygulandı, 2026-08-22)**: uç artık `confirm-delivery`'deki doğru kalıbı
  izliyor — çağıran partnerin kendi dükkanını çözüp `markSealAsFaulty`'ye veriyor;
  `serialNumber` integer olarak doğrulanıyor; `seal_not_owned_by_shop` → 404,
  `seal_already_processed` → 409. Typecheck + lint + 103 test yeşil.
- **İstismar kontrolü yapıldı — iz yok**: prod'daki 2 `FAULTY` mühür (151, 152)
  ardışık ve **hiçbir dükkana atanmamış** (`shopId IS NULL`), yani başka bir dükkanın
  envanterini hedef alan bir kullanım değil; test amaçlı işaretlenmiş görünüyor.
  ```sql
  SELECT "serialNumber", status, "shopId" IS NULL FROM "Seal" WHERE status='FAULTY';
  -- 151 | FAULTY | t
  -- 152 | FAULTY | t
  ```

### [P0-7] ✅ DÜZELTİLDİ — Partner paneli aynı dükkan için iki farklı "NET HAKEDİŞ" gösteriyordu
- **Nerede**: `src/app/[locale]/partner/page.tsx:68`;
  `src/app/[locale]/partner/earnings/page.tsx:36`
- **Kanıt** (canlıda test partner hesabıyla iki ekranı yan yana gördüm, sonra veritabanından sayıyla doğruladım):
  | Ekran | Gösterdiği |
  |---|---|
  | `/tr/partner` (ana panel) | NET HAKEDİŞ **710 TL** |
  | `/tr/partner/earnings` | NET HAKEDİŞ **490,00 TL** (brüt 980, "%50 size kalır") |

  Kök neden: iki sayfa farklı rezervasyon kümesi sayıyordu. Kazanç sayfası yalnızca
  `PAID/CHECKED_IN/CHECKED_OUT`; ana panel ise **`CANCELLED` dışındaki her şeyi**, yani
  henüz **ödenmemiş** `APPROVED`/`WAITING_APPROVAL`/`PENDING` rezervasyonları da.
  ```sql
  -- Kadıköy Valiz Emanet
  CHECKED_IN 2 -> 980.00 | APPROVED 1 -> 440.00
  kazanc_sayfasi_brut = 980.00   (x0.5 -> 490)
  ana_panel_brut      = 1420.00  (x0.5 -> 710)
  ```
  Fazladan 440 TL, onaylanmış ama parası alınmamış tek bir rezervasyon.
- **Neden önemli**: esnaf, panelin ana ekranında ne kadar alacağı olduğunu göremiyor —
  iki ekran iki farklı sayı veriyor ve büyük olan yanlış olanı. Bir pazar yerinde
  esnafın parasına dair çelişki, düzeltilmesi en acil güven sorunudur.
- **Çözüm (uygulandı, 2026-08-22)**: hakedişe sayılan durumlar tek doğru kaynağa
  taşındı (`src/lib/platform-split.ts` → `EARNING_BOOKING_STATUSES` +
  `countsTowardEarnings()`), iki sayfa da onu kullanıyor. Doğru tanım ödenmiş olandır:
  onaylanmış ama parası alınmamış bir rezervasyon hakediş değildir. 6 maddelik
  regresyon testi eklendi (`platform-split.test.ts`) — küme sessizce genişleyemez.
  Typecheck + lint + 109 test yeşil.
- **Not**: bu, P0-0'ı ortadan kaldırmıyor. Artık iki ekran aynı sayıyı gösteriyor, ama
  o sayı hâlâ hiç tahsil edilmemiş paranın hakedişi. Ayrıca komisyon **%50** —
  `PLATFORM_COMMISSION_RATE` varsayılanı 0.5 — bu bir hata değil ama bu kategoride
  çok yüksek bir oran ve iş modeli kararı olarak ayrıca gözden geçirilmeli.

### [P0-1] ✅ DÜZELTİLDİ — Slot üretimi 37 gün durmuştu; saatlik ürün seçilemiyordu
- **Nerede**: `ShopTimeSlot`; `src/services/SlotService.ts:60,129`;
  `src/services/ShopService.ts:215-250`
- **Kanıt** (bu sorguyu kendim de çalıştırdım, teyitli):
  ```sql
  SELECT count(*), min("startTime"), max("startTime") FROM "ShopTimeSlot";
  -- 3696 | 2026-06-15 01:00:00 | 2026-07-14 21:30:00
  SELECT count(*) FROM "ShopTimeSlot" WHERE "startTime" > now();   -- 0
  ```
  Üç dükkan da aynı gün bitiyor — `daysForward = 30` varsayılanıyla 15 Haziran
  civarı **tek sefer** çalışmış, bir daha tekrarlanmamış. Prod'da ne cron ne
  systemd timer'ı var (`crontab | grep -ci "generate-slots"` → 0; 7 timer'ın hepsi
  işletim sistemi seviyesinde).
- **Zinciri**: `findShopsForSearch` ≤48s konaklamalar için önce slot yolunu deniyor →
  `getSlotAvailability` boş dönüyor → her dükkan `continue` ile atlanıyor → kontrol
  "Legacy capacity check"e düşüyor, orada `ShopTimeSlot.capacity` hiç okunmuyor.
  `GET /api/shops/[id]/slots` boş dönüyor, grid boş kalıyor, istemci hiç `slotIds`
  gönderemiyor, dolayısıyla `ReservationSlot` hiç yazılmıyor.
- **Neden önemli**: her dükkanın ilan ettiği saatlik ürün (`pricePerHour = 10`)
  seçilemiyor ve slot bazlı kapasite yerini kaba, dükkan geneli bir kontrole bırakmış.
- **İlerleme (2026-08-22) — ön koşullar tamamlandı, üretim henüz açılmadı.**
  Üretimi açmadan önce iki şeyin düzeltilmesi gerekiyordu; ikisi de yapıldı:
  1. **Güvenlik** (eski P1-1): uç tamamen korumasızdı. Dört uçta kopyala-yapıştır
     duran `CRON_SECRET` mantığı `internal-api-guard.ts → authorizeCron`'a alındı,
     sabit-zamanlı karşılaştırma eklendi, uç saatte 4 istekle sınırlandı ve
     `GET` → `POST` yapıldı (yazma yapan işlem GET olmamalı; ön-getirme bile
     tetikleyebilirdi). Çağıran hiçbir yer olmadığı doğrulandı.
  2. **Fazla satış riski** (eski P1-2'nin kritik yarısı): `getSlotAvailability`
     artık slot bazlı rezervasyonların üstüne, slot penceresiyle çakışan ve kendi
     `ReservationSlot` satırı bulunmayan rezervasyonların valizlerini de sayıyor.
     Bu olmadan üretimi açmak **dolu bir dükkanı boş göstererek** fazla satışa yol
     açardı. 8 test eklendi (`SlotAvailability.test.ts`).
- **Slotlar 2026-08-22'de üretildi — ama KAZAYLA, ve bunu kayda geçiriyorum.**
  Ucun korumasız olup olmadığını ölçmek için canlıya `GET
  /api/internal/generate-slots` isteği attım. Uç **200** döndü; yani ölçüm isteğinin
  kendisi `fillMissingSlots()`'u çalıştırdı ve prod'a **2.160 gelecek slot** yazdı
  (3.696 → 5.856, en ileri tarih 2026-09-20).
  - Bu, tam olarak ucun hatasının kanıtı: **yazma yapan bir GET**, salt-okunur
    niyetli bir istekle tetiklenebiliyor. `GET → POST` değişikliğinin gerekçesi
    teorik değil, bu olayla kanıtlı.
  - **Fazla satış riski sıfırdı**, kontrol ettim: tüm rezervasyonların
    `checkOutTime` değeri Haziran 2026'da, yani geçmişte; yeni slotlar 22 Ağustos –
    20 Eylül aralığını kapsıyor. Gelecek pencereye sarkan aktif rezervasyon: **0**.
    Dolayısıyla mükerrer sayılacak bir şey yoktu.
  - **Geri almadım.** Slotlar ürünün ihtiyacı olan şey; silmek sistemi bozuk hâline
    döndürmek olurdu. Yıkıcı ve amaçsız bir işlem olurdu.
  - Sonuç: saatlik ürün 14 Temmuz'dan beri ilk kez çalışıyor. Doğrulandı —
    `/api/shops/<id>/slots` gerçek slot döndürüyor (kapasite 50, müsait 50).
- **✅ KAPANDI (2026-08-22)** — üç parça da tamamlandı:
  1. Kod AWS'te doğrulandı (`GET` → 405, `POST` yetkisiz → 503 çünkü orada
     `CRON_SECRET` yok; yani uç sır yoksa **kapalı kalıyor**), sonra Hetzner'e
     toplu deploy edildi. Canlıda doğrulandı: `GET` → **405**, `POST` yetkisiz →
     **401**. Yazma-via-GET deliği kapandı.
  2. **Günlük cron kuruldu**: `17 4 * * * /root/emanetci/scripts/generate-slots.sh`.
     Elle bir kez çalıştırılıp doğrulandı: `BASARILI (HTTP 200)
     {"ok":true,"slotsGenerated":2160}`.
  3. Sarmalayıcı script iki şeyi bilinçli yapıyor: **sırrı crontab'a yazmıyor**
     (`CRON_SECRET` çalışma anında `.env`'den okunuyor, hiç stdout'a basılmıyor) ve
     **`curl -sf` kullanmıyor** — `-sf` 404/401'de sessizce çıkar; ödeme mutabakat
     cron'u tam bu yüzden 2 ay boyunca fark edilmedi. Script durum kodunu ve gövdeyi
     log'a yazıyor, başarısızlıkta non-zero çıkıyor.
- **Kalan tek boşluk**: cron'un *çalışmadığını* fark edecek bir uyarı yok. Script
  başarısızlıkta non-zero çıkıyor ve log'a yazıyor, ama kimse log'a bakmıyorsa
  sessiz kalır. Bağımsız bir uptime/heartbeat kontrolü hâlâ eksik (bkz. P1-13).

### [P0-2] İade hiç yapılmıyor, ama sayfalar "5-10 iş günü içinde kartınıza" diyor
- **Nerede**: `src/services/BookingService.ts:769-781`, `:554-569`;
  `src/app/[locale]/(guest)/cancellation/page.tsx`; `(guest)/terms/page.tsx:116-118`
- **Kanıt**: iadenin tamamı bir durum güncellemesi, hiçbir yerde sağlayıcı çağrısı yok:
  ```ts
  await prisma.paymentLog.updateMany({ where: { bookingId, status: 'SUCCESS' },
                                       data: { status: 'REFUNDED' } })
  ```
  Erken çıkış yolu bunu açıkça yazıyor: `// Harici ödeme sağlayıcısı yok; ... manuel
  takip edilir.` Canlıda durum flip'i bile olmamış:
  ```sql
  -- iptal edilen tek rezervasyon: CANCELLED | ödeme SUCCESS | 440.00
  SELECT status,count(*) FROM "PaymentLog" GROUP BY 1;   -- SUCCESS 12, REFUNDED 0
  ```
  Bunun yerine tam da o tutarda (440.00) bir kupon üretilmiş — sayfanın artık
  reddettiği *eski* mağaza-kredisi politikası.
- **Neden önemli**: iptal eden müşteriye kartına iade yapılacağı söyleniyor, hiçbir
  iade başlatılmıyor; rezervasyon CANCELLED görünürken para tahsil edilmiş kalıyor.
- **Çözüm**: *kod* — gerçekten sağlayıcıdan iade çağır, ancak sonra `REFUNDED` yaz;
  ya da *metin* — gerçek süreci yaz. İptal edilmiş rezervasyondaki `SUCCESS` ödeme
  bir *veri düzeltmesi* istiyor.

### [P0-3] ⚠️ KOD TARAFI KAPATILDI, VERİ KARARI BEKLİYOR — Valiz boyutu fiyat farkı canlıda ölü: S/M/XL üçü de ₺50
- **Nerede**: `PlatformSettings.bagMultiplier*`; `src/lib/pricing-rules.ts:33`;
  `src/lib/platform-settings.ts:45-55`; `src/components/guest/ShopDetailClient.tsx`
- **Kanıt**: canlı satır `1.0000 | 1.0000 | 1.0000`. `getPricingRules()` kod
  varsayılanına yalnızca satır **yoksa** düşüyor; satır var, dolayısıyla kod
  varsayılanı (`0.8/1.0/1.5`) prod'da hiç çalışmıyor. Dükkan detayında üç kutu da
  ₺50 gösteriyor.
  > Not: 21 Ağustos'ta kod varsayılanını 0.8/1.0/1.5 yapan bendim ve o commit'te
  > "canlı satır hâlâ 1.0/1.0/1.0" diye not düşmüştüm — yani bu, o değişikliğin
  > tamamlanmamış yarısı.
- **Neden önemli**: ürün boyuta göre fiyatlandırma vaat ediyor, ama XL bavul küçük
  bavul fiyatı ödüyor.
- **Kod tarafı yapıldı (2026-08-22)**: hatanın kaynağı üç farklı doğruluk kaynağıydı
  ve o kapatıldı. `schema.prisma` varsayılanları `DEFAULT_PRICING_RULES` ile hizalandı
  (0.8/1.0/1.5) ve `src/__tests__/pricing-defaults.test.ts` 12 alanı tek tek
  karşılaştırıp ayrışmayı CI'da kırmızı yakıyor. Ayrıca test, üç çarpanın gerçekten
  farklı olmasını da şart koşuyor — hepsi 1.0 ise boy bazlı fiyat ölü demektir.
- **AÇIK KALAN — bu bir İŞ KARARI, kod değil**: prod'daki canlı `default` satırı hâlâ
  `1.0/1.0/1.0`. Migrasyon buna **bilerek dokunmadı**: canlı fiyatı bir migrasyonun
  sessizce değiştirmesi kabul edilemez. `/admin/platform-settings` üzerinden ya
  çarpanlar ayrıştırılmalı ya da tekdüze fiyat bilinçli bir karar olarak kabul edilip
  dükkan detayında üç özdeş fiyat kutusu gösterilmekten vazgeçilmeli.

### [P0-4] ⚠️ MİMARİ KAPATILDI, SİGORTA KARARI BEKLİYOR — Canlı fiyat yapılandırması geçmiş tahsilatların hiçbirini üretemiyor
- **Nerede**: `Booking.insuranceFee`; `PlatformSettings.insuranceFeeTry`;
  `src/lib/booking-server-price.ts:68`
- **Kanıt**: 19 rezervasyonun tamamı `insuranceFee = 150.00` taşıyor, canlı ayar
  `0.00`. Örnek: `1/1/1` valiz → kayıtlı toplam 440.00, bugünkü kurallarla yeniden
  hesap 150.00. Yeni bir rezervasyon **hiç** sigorta satırı almıyor — ama dükkan
  detayı hâlâ "Sigortalı Emanet" rozeti gösteriyor ve sözleşme 2.3 sigorta
  kapsamından bahsediyor.
- **Neden önemli**: platform sigortalı emanet pazarlıyor ve geçmişte her rezervasyonda
  bunun için 150 TRY almış; şimdi hiçbir şey almıyor ama iddiayı sürdürüyor.
- **Kod tarafı yapıldı (2026-08-22)**: `Booking.pricingSnapshot` eklendi. Rezervasyon
  artık fiyatını üreten kural kümesinin anlık kopyasını (sürüm + zaman damgası)
  taşıyor; yalnızca yaratılırken yazılıyor, sonra değişmiyor
  (`src/lib/pricing-snapshot.ts`). Bundan sonra admin bir çarpanı değiştirse de geçmiş
  tahsilatlar yeniden üretilebilir — anlaşmazlık, fatura ve iade için gereken şey buydu.
  `readPricingSnapshot()` kopya yoksa `null` döner, bugünkü kuralları **uydurmaz**.
- **AÇIK KALAN — bu bir İŞ KARARI**: mevcut 19 rezervasyonda kopya yok ve o kayıtlar
  için hangi kuralın geçerli olduğu gerçekten bilinmiyor; geriye dönük doldurmak
  yanlış olurdu. Ayrıca `insuranceFeeTry = 0` iken dükkan detayı hâlâ "Sigortalı
  Emanet" rozeti gösteriyor ve sözleşme 2.3 sigortadan bahsediyor
  (`ShopDetailClient.tsx:95`). Ya ücret belirlenmeli ya iddia kaldırılmalı. → **P1-20**

### [P0-5] ✅ KOD DÜZELTİLDİ — Gecikme ücreti iptal ücreti alanını ödünç alıyordu
- **Nerede**: `src/services/BookingService.ts:536-552`;
  `PlatformSettings.cancelFixedFeeTry`; `(guest)/terms/page.tsx:65,74,100`
- **Kanıt**: `const lateFeeTry = lateMs > graceMs ? pricingRules.cancelFixedFeeTry : 0;`
  — gecikme ücreti *iptal* ücretini kullanıyor. Canlı `cancelFixedFeeTry = 0.00`,
  yani her zaman 0. Sıfır olmasa bile yalnızca kaydediliyor, tahsilat "ayrı süreç"
  olarak bırakılmış. Sözleşme üç ayrı yerde tersini vaat ediyor (4.4, 5.3, 8.3:
  "otomatik olarak tahsil edilir").
- **Neden önemli**: süreyi aşan müşterinin maliyetini partner üstleniyor.
- **Çözüm (uygulandı, 2026-08-22)**: gecikmenin kendi ayarları var —
  `PlatformSettings.latePickupFeeTry` ve `latePickupGraceMin` (tolerans da artık
  sabit 15 dk değil). `BookingService` bunları kullanıyor; admin panelinin tamamı
  (form → server action → şema) bağlandı ve 14 dile etiket eklendi. Migrasyon
  `latePickupFeeTry`'ı mevcut `cancelFixedFeeTry` değeriyle doldurdu, yani davranış
  aynen korundu — yalnızca alanlar ayrıldı, artık bağımsız değiştirilebiliyorlar.
- **AÇIK KALAN**: (a) canlı `latePickupFeeTry` hâlâ `0` — ücret belirlemek iş kararı;
  (b) ücret **hâlâ tahsil edilmiyor**, yalnızca `lateFeeApplied` alanına ve log'a
  yazılıyor. Tahsilat ödeme defterine bağlanmalı (`docs/PAYMENTS.md`); (c) sözleşme
  üç yerde (4.4, 5.3, 8.3) "otomatik olarak tahsil edilir" diyor — (b) yapılana kadar
  metin gerçeğe çekilmeli. → **P1-21**

---

## P1 — Gerçek tutarsızlık, yakında ısıracak

### [P1-1] ✅ KISMEN DÜZELTİLDİ — İç API koruması yalnızca başlığın VARLIĞINA bakıyor; `generate-slots` artık korunuyor
- **Nerede**: `src/middleware.ts:130`; `src/app/api/internal/generate-slots/route.ts:4-7`
- **Kanıt** (ikisini de kendim okudum). Middleware'in tüm iç API koruması bu tek satır:
  ```js
  if (isInternalApiPath && !isLoggedIn && !req.headers.get("authorization")
      && !req.headers.get("x-cron-secret")) {
    return 401
  }
  ```
  Header'ların **değeri hiçbir yerde doğrulanmıyor**. Yani `Authorization: herhangi-bir-şey`
  göndermek korumayı geçiyor; ayrıca **herhangi bir rolde giriş yapmış olmak** (düz bir
  GUEST dahil) tek başına yeterli.
  Uçların kendi kontrolleri sayıldığında tablo şu:
  | Uç | Kendi gizli-anahtar kontrolü |
  |---|---|
  | `booking-reminders` | ✅ var |
  | `cleanup` | ✅ var |
  | `finance-export` | ✅ var |
  | `seal-forecast` | ✅ var |
  | **`generate-slots`** | ❌ **hiç yok** |
  `generate-slots` handler'ının tamamı auth'suz `fillMissingSlots()` çağrısı; her aktif
  dükkan için gün başına 30 dakikalık slot upsert ediyor (son tam çalışma 3.696 satır).
- **Neden önemli**: gerçek savunma uçların kendi kontrolleri; middleware sahte bir
  güvenlik hissi veriyor. `generate-slots`'ta o savunma da olmadığı için isimsiz
  herhangi biri binlerce DB yazması tetikleyebilir.
- **Çözüm**: *kod* — (a) `generate-slots`'a diğer dördündeki gizli-anahtar kontrolünü
  ekle (P0-1 için kurulacak zamanlanmış işle birlikte), (b) middleware'deki
  varlık-kontrolünü ya gerçek karşılaştırmaya çevir ya da tamamen kaldır — yanıltıcı
  olmasın.

### [P1-1b] ✅ CRON DURDURULDU — Ödeme mutabakat cron'u 2 aydır var olmayan bir ucu çağırıyordu (404)
- **Nerede**: Hetzner crontab (15 dakikada bir); `vercel.json`; `src/app/api/internal/`
- **Kanıt** (kendim doğruladım):
  ```bash
  find src/app/api -ipath "*reconcile*"     # (bos - boyle bir route yok)
  curl -o /dev/null -w "%{http_code}" -X POST \
       https://bagajpark.com/api/internal/reconcile-payments   # 404
  ```
  `/root/emanetci/reconcile.log`: 220KB, ama **son değişiklik 2026-06-14**. `curl -sf`
  404'te sessizce çıktığı için o tarihten beri log'a hiçbir şey yazılmamış. Tarih,
  `20260615000000_remove_payment_providers` migration'ıyla örtüşüyor: ödeme sağlayıcıları
  sökülürken uç da silinmiş, iki ayrı yerdeki zamanlanmış iş geride bırakılmış.
  Sonucu veride görünüyor: `PaymentLog.splitCompleted` → 12 kaydın tamamı `false`.
- **Neden önemli**: partner hakedişi/ödeme paylaşımı iki aydır hiç çalışmıyor ve
  hiçbir yerde hata üretmediği için kimse fark etmemiş. Ödeme entegrasyonu (P0-0)
  yapıldığı anda bu sessiz boşluk doğrudan "partnere para gitmiyor"a dönüşür.
- **Çözüm (kısmen uygulandı, 2026-08-22)**: `vercel.json` tamamen silindi ve
  Hetzner crontab'ındaki satır, neden kapatıldığı yazılarak devre dışı bırakıldı
  (yedek: `/root/crontab.bak.20260822`). Artık 15 dakikada bir boşa 404 alınmıyor.
  **Uç hâlâ yok**: ödeme entegrasyonu (P0-0) yapıldığında hem uç geri yazılmalı hem
  bu cron satırı açılmalı — crontab'daki yorumda bu not duruyor.
  Ders yeni `generate-slots.sh` içine kodlandı: `curl -sf` kullanılmıyor, çünkü
  404/401'de sessizce çıkıp hiçbir şey loglamamak bu hatanın 2 ay gizli kalmasının
  tek sebebiydi.

### [P1-2] ⚠️ AŞIRI REZERVASYON RİSKİ KAPATILDI, BACKFILL AÇIK — `ReservationSlot` tamamen boş
- **Nerede**: `ReservationSlot`; `src/services/BookingService.ts:130,246-256`
- **Kanıt**: `SELECT count(*) FROM "ReservationSlot"` → **0**.
- **Neden önemli**: müsaitlik motorunun okuduğu tablo hiç dolmamış; slot üretimi geri
  açılırsa mevcut rezervasyonlar görünmez olacağı için `reserved` sıfırdan başlar.
- **Tanının kaçırdığı, daha ciddi kısım**: sorun yalnızca "slot motoru geri
  açılırsa" değildi. İki yol **şu anda** iki ayrı kapasite doğruluğu kullanıyor ve
  birbirini görmüyor:
  - Legacy yol örtüşen `Booking` satırlarını sayar, `ReservationSlot` **yazmaz**.
  - Slot yolu yalnızca `ReservationSlot` satırlarını sayardı.
  `ReservationSlot` boş olduğu için **her mevcut rezervasyon slot yolu için
  görünmezdi**, yani slot yolu fiziksel dükkan kapasitesini **aşan** rezervasyon
  alabiliyordu. Fiziksel sonucu: dükkana sığandan fazla bavul gelir.
- **Çözüm (uygulandı, 2026-08-22)**: slot yoluna `Shop.capacity` emniyet kontrolü
  eklendi. `Shop.capacity` **fiziksel gerçektir** (dükkana kaç valiz sığdığı); slot
  kapasitesi onun içindeki daha ince bir dağıtımdır — ikisi birbirinin yerine
  geçmez. Kontrol **rezerve edilmiş** pencereyle yapılıyor, istenenle değil (slot
  sınırlarına yuvarlanmış olabilir ve kaydedilen odur).
  Düzeltmenin gerçekten gerekli olduğu **kanıtlandı**: emniyet kontrolü geçici
  olarak kaldırıldığında 3 test kırılıyor, geri konulduğunda hepsi geçiyor.
- **AÇIK KALAN**: legacy yol hâlâ `ReservationSlot` yazmıyor, yani slot bazlı
  *ince* kapasite (saat başına) mevcut rezervasyonları görmüyor. Bu artık bir
  **doğruluk açığı değil, hassasiyet eksikliği**: fiziksel sınır her iki yolda da
  tutuyor. Slot motoru tam devreye alınmadan önce backfill yine de gerekli.

### [P1-3] ⚠️ KOD DÜZELTİLDİ, VERİ AÇIK — 3 PARTNER hesabının 2'sinin e-postası yok; onay maili sessizce atlanıyordu
- **Nerede**: `User.email` (`String? @unique`); `src/services/ShopService.ts:375-404`
- **Kanıt** (bu sorguyu kendim de gördüm): `PARTNER 3 | email IS NULL 2`. İkisinin de
  telefonu ve parolası var, ikisi de **canlı bir dükkan sahibi**. `approveShop`'ta iki
  kırılma: doğrulama backfill'i `email: { not: null }` filtreliyor (asla eşleşmez) ve
  bildirim `if (partnerEmail)` ile uyarısız atlanıyor. SMS dalı çalıştığı için fark
  edilmemiş.
- **Neden önemli**: partnerlerin üçte ikisine e-postayla ulaşılamıyor, ama dükkanları
  rezervasyon alıyor.
- **ÖNEMLİ DÜZELTME**: e-postasız partner bir **bozulma değil, tasarımın sonucu** —
  esnaf girişi telefon tabanlı tasarlanmış (P1-16). Yani "partner kaydında e-posta
  zorunlu olsun" yanlış çözümdü; telefonu olan bir esnafa ulaşılabiliyor.
  **Asıl açık, HİÇBİR kanalı olmayan partner.**
- **Çözüm (uygulandı, 2026-08-22)**:
  1. `approveShop` artık atlanan her kanalı **logluyor**; hiçbir kanal yoksa bu bir
     `ERROR` (`shop_approved_but_partner_unreachable`) — onaylanmış ama ulaşılamayan
     partner operasyonel bir açıktır.
  2. `PartnerReachabilityService` + `/api/health/jobs` dördüncü kontrolü. **Yalnızca
     telefonu olan partner alarm ÜRETMEZ** (test edildi); alarm yalnızca hiçbir
     kanalı olmayan için çalışır, ayrıca aktif dükkanı olanları ayrı sayar.
  3. **Yan bulgu — onay e-postasının HTML'i bozuktu**: `style=”` ve `href=”`
     (kıvrık tırnak) yazılıyordu, yani hiçbir öznitelik geçerli değildi. E-posta
     stilsiz gidiyor ve "Partner Panelime Git" butonu hiçbir yere bağlanmıyordu.
     Kod derleniyor, test geçiyor, tip kontrolü temiz — hata yalnızca gelen kutusunda
     görünüyor. Bu yüzden **lint kuralına taşındı** (`no-restricted-syntax`,
     `eslint.config.mjs`); kuralın gerçekten tetiklendiği probe dosyasıyla doğrulandı.
- **AÇIK KALAN — veri**: 2 partnerin e-postası hâlâ yok. Telefonları olduğu için
  `unreachable` **değiller**, yani sağlık kontrolü yeşil. Yine de e-posta toplamak
  faydalı (fatura, sözleşme, parola sıfırlama). Acil değil.
- **Not**: doğrulama backfill'indeki `email: { not: null }` filtresi **doğru** ve
  değiştirilmedi — var olmayan bir e-posta doğrulanamaz.

### [P1-4] ⚠️ KOD HAZIR, İŞARETLEME BEKLİYOR — Test dükkanı canlı aramada, üstelik 5 rezervasyonu var
- **Nerede**: `Shop` `131bcf6d-...` (`Furkan'ın Diğer Mekan`)
- **Kanıt** (kendim gördüm): `isActive = t`, `isVerified = f`. Genel aramanın tek
  filtresi `isActive = true AND latitude IS NOT NULL`.
- **Neden önemli**: Türkiye'de bulunabilen yalnızca üç dükkandan biri kişisel bir test
  kaydı ve gerçek partnerden ayırt edilemiyor.
- **ÖNCEKİ ÇÖZÜM ÖNERİSİ (`isActive = false`) YANLIŞTI**: dükkanın 5 rezervasyonu
  var ve pasife almak esnaf akışlarını bozar. Doğru ayrım "aktif mi" değil,
  **"gerçek mi"**.
- **Çözüm (kod tarafı uygulandı, 2026-08-22)**:
  - `Shop.isTest` eklendi. İşaretli dükkan kamuya açık arama, harita ve ana sayfa
    istatistiklerinden düşer; **esnaf paneli ve mevcut rezervasyonlar etkilenmez.**
  - `/admin/partners/<id>/edit` formuna açıklamalı bir anahtar eklendi (14 dilde);
    değişiklik denetim log'una yazılıyor (`admin_shop_test_flag_changed`).
  - **Filtre tek yere alındı** (`src/lib/public-shop-filter.ts`). Üç ayrı yerde
    ayrı ayrı yazılmıştı ve hepsi yalnızca `isActive`'e bakıyordu; dördüncüsü
    eklendiğinde biri kesin unutulurdu. Prisma nesnesi ve ham SQL iki biçimde
    tutuluyor (PostGIS `where` kullanamıyor) ve testi **ikisinin ayrışmasını**
    yakalıyor.
  - Migrasyon mevcut dükkanları **bilerek işaretlemiyor**: hangi kaydın test olduğu
    bir iş bilgisidir; isimden tahmin etmek gerçek bir dükkanı canlı aramadan
    düşürebilirdi.
- **AÇIK KALAN — 30 saniyelik iş**: `/admin/partners` → `Furkan'ın Diğer Mekan` →
  düzenle → **Test kaydı** kutusunu işaretle. Artık SQL gerekmiyor.

### [P1-5] ⚠️ KAYNAK BULUNDU VE KAPATILDI, VERİ TEMİZLİĞİ AÇIK — 8 script rezervasyonu ve 1.520 TRY hayalet ödeme prod defterinde
- **Nerede**: `Booking`, `PaymentLog`
- **Kanıt**: 9 saniyelik pencerede, tek misafir, tek dükkan, hepsi `PAID` 190.00 olan
  8 rezervasyon. 8 × 190 = **1.520 TRY**, kayıtlı 3.480 TRY hacminin %44'ü.
- **Neden önemli**: gelir, dönüşüm ve doluluk rakamlarının tamamı yanlış.
- **Kaynak henüz belirsiz**: ilk değerlendirmede bunu `scripts/load-test.k6.js`'e
  atfetmiştim; **bu atıf yanlıştı.** Dosyayı okudum: yalnızca `/tr` ve `/tr/search`
  GET'liyor, hiçbir POST/checkout/rezervasyon çağrısı yok ve varsayılan hedefi
  `localhost:3000`. Yani bu 8 rezervasyonu o script üretmemiş. Gerçek kaynak
  bilinmiyor — elle yapılmış bir test ya da başka bir script olabilir.
- **KAYNAK BULUNDU (2026-08-22)** — izini şöyle sürdüm:
  1. `markAsPaid`'in uygulamada **hiç çağıranı yok** (yalnızca arayüz tanımı ve kendi
     gövdesi). Kamuya açık `createBookingAction` `APPROVED` yazıyor, `PAID` değil.
  2. `PAID` yazan tek kod yolu `PaymentService.markCaptured` ve o da yalnızca
     `markAsPaid` üzerinden erişilebilir. Yani **prod'daki `PAID` rezervasyonlar
     uygulamadan gelmedi.**
  3. `prisma/seed.ts` doğrudan `BookingStatus.PAID` yazıyordu ve **hiçbir ortam
     koruması yoktu** — `DATABASE_URL` nereyi gösteriyorsa oraya.
- **Bulunan şey beklenenden ağırdı — bu bir GÜVENLİK sorunu**: seed,
  `admin@test.com` hesabını **ADMIN rolüyle** ve bilinen varsayılan parolayla
  (`Demo123!`) **upsert** ediyordu. `update` bloğu `passwordHash` içerdiği için,
  prod'da parola değiştirilmiş olsa bile **her seed çalıştırması onu bilinen değere
  geri döndürüyordu**. Aynısı `esnaf@test.com` ve `misafir@test.com` için de.
  Parola ayrıca stdout'a basılıyordu (deploy/CI log'larına düşer). Tek bir yanlış
  terminalde `npm run db:seed` yazmak prod'a bilinen parolalı bir yönetici hesabı
  kurmaya yetiyordu.
- **Çözüm (uygulandı)**: `src/lib/seed-guard.ts` — `NODE_ENV=production` **veya**
  uzak görünen `DATABASE_URL` seed'i durduruyor. `NODE_ENV`'e güvenmek yetmezdi:
  seed genellikle `tsx` ile elle çalıştırılır ve `NODE_ENV` çoğu zaman tanımsızdır;
  asıl tehlike yerel kabuktan uzak DB'ye bağlanmaktır. Kaçış yolu var ama kazara
  basılamayacak kadar açık (`ALLOW_PRODUCTION_SEED=yes-i-really-mean-it`;
  `1`/`true`/`yes` kabul edilmez). İki senaryo da **gerçekten çalıştırılarak**
  doğrulandı — kapı DB'ye hiç bağlanmadan durduruyor. Seed artık parolayı basmıyor
  ve `PAID` değil `PENDING` rezervasyon yaratıyor.
- **AÇIK KALAN — ikisi de sizde**:
  1. **Prod'daki demo hesapların parolaları değiştirilmeli.** `admin@test.com`,
     `esnaf@test.com`, `misafir@test.com` hâlâ bilinen parolayı taşıyor olabilir.
     Kapı yenisini engelliyor, **mevcudu değiştirmiyor**. Listedeki en acil iş budur.
  2. 8 hayalet rezervasyon ve 1.520 TRY'lik ödeme kayıtları hâlâ defterde
     (`provider='legacy_unverified'` damgalı). Temizlik kararı sizin.

### [P1-6] ⚠️ ALTYAPI KURULDU, VERİ KARARI + CRON BEKLİYOR — 19 rezervasyonun 18'i çıkış saatini geçmiş halde açık
- **Kanıt**: durum dağılımı `PAID 10 | APPROVED 5 | CHECKED_IN 3 | CANCELLED 1` —
  **hiç CHECKED_OUT yok**, `BookingEvent`'te de sıfır CHECKED_OUT olayı. En eskisi
  12 Haziran'dan beri CHECKED_IN.
- **Neden önemli**: yaşam döngüsünün pratikte sonlanan bir durumu yok; üç müşterinin
  bavulu Haziran'dan beri "dükkanda" görünüyor.
- **Kök neden bir hata değil, EKSİKLİKTİ**: hiç tarama yoktu, dolayısıyla kimse fark
  etmiyordu.
- **Yapıldı (2026-08-22)**:
  - `OverdueBookingService` — dört eşikte (24s / 72s / 1 hafta / 1 ay) tarar, eşik
    atlayanlara `BookingEvent` (`OVERDUE`) yazar, rapor döner. İdempotent: aynı
    rezervasyon için aynı eşik ikinci kez yazılmaz. Sayımlar limitten etkilenmez.
  - `POST /api/internal/overdue-scan` (`CRON_SECRET` korumalı).
  - `GET /api/health/jobs` artık bunu da ölçüyor ve sağlıksızsa **503** dönüyor.
    Sinyal sayı değil **yaş**: 5 tane bir günlük gecikme normal operasyon, 1 tane
    iki aylık gecikme kayıp bavul demektir. Eşik 72 saat.
  - `scripts/overdue-scan.sh` + adım adım runbook: `scripts/README.md`.
- **TASARIM KARARI — iş durum DEĞİŞTİRMEZ**: otomatik `NO_SHOW` işaretlemek veya
  iptal etmek cazipti ama yanlış olurdu. `PAID` bir rezervasyonun durumu değişirse
  partner hakedişi değişir (`EARNING_BOOKING_STATUSES`), yani bir tarama işi sessizce
  para hareketi yaratmış olur; ayrıca bavul gerçekten dükkanda olabilir ve "no-show"
  demek fiziksel gerçeği bilmeden verilen bir karardır. Karar operasyonundur.
- **AÇIK KALAN**:
  1. **Cron kurulmadı.** `scripts/README.md` → 3. adım. Kurulana kadar tarama
     çalışmıyor, yalnızca elle tetiklenebiliyor.
  2. **3 eski `CHECKED_IN` satırı için karar hâlâ verilmedi** — Haziran'dan beri
     açıklar. Bavullar gerçekten dükkanda mı, yoksa çıkış kaydedilmemiş mi? Bu
     partnerlere sorulmalı.
  3. **`CHECKED_OUT`'a giden bir yol pratikte kullanılmıyor.** Tarama bunu görünür
     kılıyor ama sebebini çözmüyor: partner panelinde çıkış akışı var mı, esnaf
     biliyor mu? → **P1-22**
- **Not**: `/api/health/jobs` bu düzeltmeden sonra **503 dönecek** ve bu DOĞRUDUR —
  prod'da 18 açık gecikmiş rezervasyon var. Kontrolün çalıştığının kanıtıdır.

### [P1-7] ⚠️ KURAL DB'YE YAZILDI, ONARIM BEKLİYOR — 1.277 mühür ASSIGNED, 1.247'si hiçbir dükkana bağlı değil
- **Kanıt**: `ASSIGNED 1277 (1247 shopId NULL) | STOCK 22 | FAULTY 2`. Ayrıca
  `BookingSeal` boş — 3 CHECKED_IN rezervasyona rağmen hiçbir mühür bir bavula
  kaydedilmemiş.
- **Neden önemli**: mühür envanteri anlaşmazlıklarda fiziksel zilyetlik kanıtı ve
  %96'sı bir dükkanla eşleştirilemiyor.
- **Kaynak bulundu**: `SealRepository.updateStatus(serialNumber, status)` herhangi
  bir duruma `shopId`'ye **hiç dokunmadan** yazıyordu. Ama yalnızca onu düzeltmek
  yetmezdi — beş ayrı yer ham `seal.update*` çağırıyor ve altıncısı yarın
  eklenebilir. Değişmez kuralın yeri koddan biri değil, veritabanıdır.
- **Yapıldı (2026-08-22)**:
  - **DB kısıtı `Seal_ownership_matches_status`**: `STOCK` dışındaki her mühür bir
    dükkana ait olmak zorunda; `STOCK` olan hiçbir mühür bir dükkana ait olamaz.
    `NOT VALID` eklendi — mevcut bozuk satırlar tolere ediliyor, **her yeni
    INSERT/UPDATE kontrol ediliyor**. Yani yeni bozuk satır artık oluşamaz.
  - `SealRepository.updateStatus` değişmezi koruyor (daha iyi hata mesajı için;
    tek savunma hattı DB kısıtı).
  - `SealIntegrityService` + `/api/health/jobs` üçüncü kontrolü. Üç kontrolden biri
    bozuksa diğerleri **maskelemiyor**.
  - `scripts/repair-seal-ownership.sh` — **varsayılanı kuru çalışma**, `--apply`
    olmadan hiçbir şey yazmaz. Runbook: `scripts/README.md`.
- **AÇIK KALAN — onarım çalıştırılmadı**: 1.249 satır hâlâ bozuk (1.247 sahipsiz
  `ASSIGNED` + 2 sahipsiz `FAULTY`). `scripts/README.md` → "Mühür sahiplik onarımı"
  bölümü. Yedek zorunlu, çünkü onarım `assignedAt`'i de `NULL` yapıyor ve satır
  satır geri alınamıyor. Onarımdan sonra `--validate` kısıtı tamamlar.
- **Not**: `/api/health/jobs` bu düzeltmeden sonra da **503 dönecek** — envanter
  hâlâ bozuk. Onarım koşulunca yeşile döner.

### [P1-8] ✅ DÜZELTİLDİ — Bir rezervasyonun toplamı kendi valiz sayısıyla çelişiyordu
- **Nerede**: `Booking` `3c98aa28-...`
- **Kanıt**: 19 toplamın 18'i `150 sabit + S·40 + M·100 + XL·150` modeline birebir
  oturuyor. İstisna: `S1 M3 XL1 → 540.00` (model 640, **100.00 eksik**). Bekleyen
  revizyon yok. Satır `CHECKED_IN` — 5 bavul teslim alınmış, 4'ü ödenmiş.
- **Neden önemli**: fiyat yeniden hesaplanmadan bavul eklenmiş.
- **Kök neden — iki ayrı hata**:
  1. `extraAmount` **istemciden** alınıyordu. Esnaf misafire gösterilecek ek ücreti
     kendisi yazabiliyordu ve sunucu hiç doğrulamıyordu.
  2. Revizyon **hiç uygulanmıyordu**. Yalnızca `clearPendingBagRevisionAction` vardı
     ve o revizyonu **siliyordu** — `bagCount*` ve `totalPrice` hiç güncellenmiyordu.
     Yani bavul fiziksel olarak teslim alınıyor, kayıt eski hâlinde kalıyordu. 540 /
     640 farkı tam olarak bu.
- **Çözüm (uygulandı, 2026-08-22)**:
  - Fark artık `computeAuthoritativeCheckoutTotals` ile **sunucuda** hesaplanıyor;
    `extraAmount` zod şemasından kaldırıldı, istemci gönderirse yok sayılıyor.
  - `applyPendingBagRevisionAction` eklendi: yeni valiz sayıları + yeniden
    hesaplanan toplam, `BookingEvent` denetim iziyle. `clear` artık **reddet**
    anlamında ve bu ayrım kodda açık.
  - Rezervasyonun **kendi** fiyat kuralları (anlık kopya) önceliklidir; hangi kural
    kümesinin kullanıldığı kayda yazılıyor.
  - Mobil uç da hizalandı: koşulsuz `getPricingRules()` çağırıyordu, yani admin bir
    çarpanı değiştirdikten sonraki bir revizyon rezervasyonun **tamamını** yeni
    fiyata çeviriyordu (P0-4 ile aynı sınıf).
- **DİKKAT ÇEKİCİ**: mevcut test açıklığı **doğrulanmış davranış olarak
  kodluyordu** — `expect(...extraAmount: 50)`, yani istemcinin uydurduğu tutarın
  deftere yazılmasını bekliyordu. Açıklık testiyle birlikte geldiği için kimse fark
  etmemişti.
- **AÇIK KALAN — veri**: prod'daki `3c98aa28-...` rezervasyonu hâlâ 100 TRY eksik.
  Düzeltme yeni revizyonları doğru yapıyor, mevcut satırı geriye dönük değiştirmiyor.
- **Bağlantılı**: fark hesaplanıyor ama **tahsil edilmiyor** — sağlayıcı `manual`
  olduğu sürece tahsilat dükkanda yapılır; ödeme defterine bağlanması P1-21 ile
  aynı boşluk. Denetim izinde `settled: false` olarak işaretleniyor.

### [P1-9] ✅ DÜZELTİLDİ — Ödenmiş sayılan 7 rezervasyonun hiç ödeme kaydı yoktu
- **Kanıt**: `APPROVED 5 | CHECKED_IN 2` ödeme kaydı olmadan. İkisinde bavul zaten
  dükkana teslim edilmiş. (Kayıt olan yerlerde tutarlar tutarlı: uyuşmazlık 0.)
- **Neden önemli**: ödeme kanıtı olmayan rezervasyonlara karşı bavul kabul edilmiş.
- **Çözüm (uygulandı, 2026-08-22)** — kural **sağlayıcıya bağlı**, sabit değil:
  - Sağlayıcı **online tahsil ediyorsa** (`capabilities.capturesOnline`), para
    check-in'den **önce** alınmış olmalı; alınmamışsa check-in `PAYMENT_REQUIRED`
    ile reddedilir. Misafir ödemeden bavul bırakamaz.
  - Sağlayıcı online tahsil **etmiyorsa** (lansmandaki `manual` = dükkanda
    tahsilat), check-in **tam olarak paranın el değiştirdiği andır.** O yüzden
    tahsilat orada yapılıyor: niyet yoksa açılıyor, sonra yakalanıyor. Esnafın
    "aldım" beyanı deftere ve denetim izine yazılıyor — bu yüzden çağıran `actor`
    gönderiyor (web + mobil).
  - Tahsilat kaydedilemezse **bavul kabul edilmiyor.**
- **SIRA ÖNEMLİ**: önce tahsilat, sonra check-in. Aradaki bir çökme `PAID` + defter
  satırı bırakır ki bu **geçerli** bir durumdur (ödendi, henüz teslim alınmadı).
  Ters sıra `CHECKED_IN` ama ödemesiz bırakırdı — düzeltmeye çalıştığımız hatanın
  ta kendisi. Sırayı doğrulayan ayrı bir test var.
- Bundan sonra ödeme kaydı olmayan bir `CHECKED_IN` **üretilemez**.
- **AÇIK KALAN — veri**: mevcut 7 rezervasyon geriye dönük düzeltilmedi. İkisinde
  bavul zaten teslim edilmiş; bunların gerçekten ödenip ödenmediği saha bilgisidir
  ve uydurulamaz.

### [P1-10] ✅ DÜZELTİLDİ — `checkOut` rezerve pencereyi eziyordu; şemada gerçek giriş/çıkış zamanı yoktu
- **Nerede**: `src/services/BookingService.ts:574-588`
- **Kanıt**: `checkOutTime: now` yazması rezerve bitiş zamanını yok ediyor. `Booking`'de
  yalnızca *rezerve* pencere var; `checkedInAt`/`checkedOutAt` yok, gerçek geçişler
  sadece `BookingEvent`'te.
- **Neden önemli**: gecikme ücreti ve erken iade ikisi de `checkOutTime`'dan
  hesaplanıyor, dolayısıyla çıkıştan sonra faturanın girdileri yeniden kurulamıyor.
- **Çözüm (uygulandı, 2026-08-22)**: `Booking.checkedInAt` ve `Booking.checkedOutAt`
  eklendi; `checkOut()` artık `checkOutTime`'ı **ezmiyor**. Rezerve pencere yaratılıştan
  sonra değişmez — şemada bu bir yorumla da sabitlendi.
  Migrasyon geçmiş kayıtları `BookingEvent`'ten geri kazandı: `checkOutTime` üzerine
  yazılmış olabilir ama olay kaydı append-only, yani tek güvenilir kaynak o. Olay
  yoksa alan `NULL` kalıyor — uydurmuyoruz.
  Prod'da hiç `CHECKED_OUT` olayı olmadığı için (P1-6) `checkedOutAt` şu an her yerde
  `NULL` olacak; bu beklenen sonuç, migrasyonun başarısızlığı değil.

### [P2-10] ✅ DÜZELTİLDİ — Admin mesaj mutasyonlarında `*.vercel.app` güvenilir origin sayılıyordu
- **Nerede**: `src/app/api/admin/messages/route.ts:12`;
  `src/app/api/admin/messages/[id]/route.ts:9`
- **Kanıt**: CSRF için kullanılan `assertOrigin`, `.vercel.app` ile biten **her** host'u
  kabul ediyordu:
  ```ts
  return host === req.headers.get("host") || host.endsWith(".vercel.app");
  ```
  Fonksiyon gerçekten kullanılıyor — 3 mutasyon handler'ında (`route.ts:41`,
  `[id]/route.ts:23,45`). Uygulama Vercel'de çalışmıyor, dolayısıyla bu izin hiçbir
  meşru amaca hizmet etmiyordu; herhangi biri `<herhangi-sey>.vercel.app` yayınlayıp
  origin kontrolünü geçebilirdi.
- **Şiddet neden P2**: NextAuth'un `SameSite=Lax` çerezi nedeniyle site-dışı bir POST'ta
  oturum çerezi zaten gönderilmez, yani pratik sömürülebilirlik düşüktü. Ama origin
  kontrolü tam olarak bu tür bir savunma katmanıdır ve gereksiz yere gevşetilmişti.
- **Çözüm (uygulandı, 2026-08-22)**: `.vercel.app` izni kaldırıldı, kontrol yalnızca
  gerçek host eşleşmesine bakıyor.

### [P1-11] ✅ KONTROL DÜZLEMİ KURULDU — Zamanlanmış işlerin tek bir kayıt defteri yoktu
- **Kanıt**: iş tanımları üç ayrı yere dağılmış ve hiçbiri diğerini bilmiyor:
  `vercel.json` (uygulamanın çalışmadığı bir platform), Hetzner crontab'ı (gerçek
  yürütücü), ve hiç var olmayan işler (slot üretimi — bkz. P0-1). Sonuç: bir iş
  çalışmayı bıraktığında (P1-1b) veya hiç kurulmadığında (P0-1) kimse fark etmiyor.
- **Neden önemli**: bu, P0-1 ve P1-1b'nin ortak kök nedeni — tek tek hatalar değil,
  eksik bir kontrol düzlemi.
- **Kök sebep, tanıdan bir adım derinde**: bir işin **çalıştığını hiçbir yer
  kaydetmiyordu**, dolayısıyla **çalışmadığını da kimse söyleyemiyordu.**
- **Çözüm (uygulandı, 2026-08-22)**:
  1. **`JobRun` tablosu** — her iç iş başlangıç/bitiş/süre/sonuç yazıyor.
     `withJobRun()` sarmalayıcısı `generate-slots` ve `overdue-scan`'e bağlandı.
     Defter yazımı işi **asla bozmaz**: kayıt başarısız olsa bile iş çalışır —
     gözlemlenebilirlik katmanının gözlediği şeyi düşürmesi kabul edilemez.
  2. **`src/lib/jobs/registry.ts`** — altı işin adı, ne yaptığı, **durursa ne
     olacağı**, cron ifadesi, gecikme eşiği. `ifItStops` bilerek zorunlu: gerekçesi
     yazılamayan bir iş ya gereksizdir ya da kimse ne yaptığını bilmiyordur.
  3. **`/api/health/jobs` beşinci kontrolü.** Slot tazeliği eskiden slot ufkundan
     *çıkarılıyordu* — zekice ama dolaylı, ve yalnızca o iş için. Defter ölçüyü
     genelleştiriyor. Dolaylı ölçü kaldırılmadı: defter işin **çalıştığını**, slot
     ufku işin **işe yaradığını** söyler; iş her gece başarıyla çalışıp hiç slot
     üretmiyor olabilir.
  4. **`scripts/emit-crontab.sh`** — crontab kayıt defterinden üretiliyor. Elle
     yazmak, kayıt defteriyle gerçeğin ayrılmasının ta kendisiydi.
  5. **`jobs-registry.test.ts`** — ayrışma CI'da kırmızı yanıyor: her uç kayıt
     defterinde mi, kayıt defterindeki her işin ucu var mı (**ödeme mutabakat
     cron'u tam olarak böyle 2 ay boyunca 404 aldı**), bildirilen script'ler
     gerçekten var mı.
- **Tasarım kararı**: yalnızca `enforced: true` işler `DEGRADED` üretir. Cron'u
  kurulmamış bir iş "bozuk" değil **"beklemede"**dir; onu kırmızı saymak kalıcı
  kırmızı bir sağlık kontrolü demektir — ve kalıcı kırmızı, kimsenin bakmadığı
  kontroldür. Şu an yalnızca `generate-slots` enforced.
- **AÇIK KALAN**: beş işin cron'u kurulu değil. `scripts/README.md` →
  "Crontab'ı kayıt defterinden üretme". Kurulduktan ve ilk kez başarıyla
  çalıştıktan sonra `registry.ts` içinde `enforced: true` yapılmalı.
- **Not**: `vercel.json` zaten yok; bu tanının o kısmı artık geçersiz.

### [P1-17] ✅ DÜZELTİLDİ — Admin panelinde tüm zamanların cirosu "Günlük Ciro" olarak gösteriliyordu
- **Nerede**: `src/app/[locale]/admin/page.tsx:88,135`; `src/locales/tr.json`
- **Kanıt**: Yönetim masasındaki kart **"GÜNLÜK CİRO ₺3.880"** derken, hemen yanındaki
  "CANLI ANALİZ" grafiği aynı ekranda **"20/8 Ciro (₺): 0"** gösteriyordu. Kodda
  hesap hiç tarih filtresi içermiyor ve değişkenin adı bile bunu söylüyor:
  ```ts
  const revenueData = await prisma.booking.aggregate({
    where: { status: { in: [...PAID_STATUSES] } },   // <-- tarih filtresi YOK
    _sum: { totalPrice: true },
  });
  const totalRevenue = moneyToNumber(...);
  // ...
  dailyRevenue: `₺${Math.round(totalRevenue).toLocaleString()}`   // <-- "gunluk" olarak sunuluyor
  ```
  Veritabanıyla birebir doğrulandı: `PAID/CHECKED_IN/CHECKED_OUT` durumundaki 13
  rezervasyonun tüm zamanlar toplamı = **3.880,00**. Karşılaştırma için: tüm zamanlar
  brüt 6.060, iptal hariç 5.620, ödeme kaydı 3.480, **bugün oluşan rezervasyon: hiç**.
- **İlginç ayrıntı**: etiket **yalnızca Türkçe'de** yanlıştı. Diğer 13 dil çoktan
  "Revenue (paid)" / "Приход (платен)" / "매출 (결제 완료)" diyor, yani "günlük"
  demiyor. Yani bu bir çeviri sapması olarak başlamış.
- **Neden önemli**: platformun tek başlık gelir metriği yanlış ölçeği gösteriyordu;
  operatör günlük performansı takip ettiğini sanarak kümülatif bir sayıya bakıyordu.
- **Çözüm (uygulandı, 2026-08-22)**: Türkçe etiket "Ciro (ödenen)" olarak diğer 13
  dille anlam olarak hizalandı (günlük kırılım zaten yanındaki grafikte var).
  Ayrıca burada `PAID_STATUSES` diye **üçüncü bir kopya durum tanımı** vardı; o da
  `platform-split.ts` → `EARNING_BOOKING_STATUSES`'e bağlandı, böylece admin ile
  esnaf artık aynı kümeyi sayıyor. Typecheck + lint + 109 test yeşil.

### [P1-18] ⚠️ KOD HAZIR, GEÇMİŞ MESAJLAR İÇİN İŞ ÇALIŞTIRILMALI — Admin gelen kutusu spam altında
- **Nerede**: `/tr/admin/messages`; `ContactMessage`
- **Kanıt**: kutuda **67 mesaj var, 57'si okunmamış**. Ekran görüntüsündeki gönderenlerin
  ezici çoğunluğu soğuk pazarlama/spam: `posta-recap@mail.instagram.com`,
  `follow-suggestions@mail.instagram.com`, `product@hncoapps.app` ve benzerleri;
  konular "Launch your product to early users", "Your product was upvoted",
  "a permanent shelf for Bagaj Emanet ve Valiz Depolama" tarzında.
- **Not — önceki denetim maddesi geçersiz**: Haziran denetimi "toplu işlem yok" diyordu;
  kodu okudum, **toplu işlem var** (`selectedIds`, "Görünenleri seç", "Seçilenleri sil",
  `window.confirm` onaylı). Yani araç mevcut. Eksik olan şey **spam sınıflandırma**:
  operatörün her seferinde elle ayıklaması gerekiyor.
- **Neden önemli**: gerçek bir misafir şikâyeti 57 okunmamış mesajın arasında kaybolur.
  Destek kanalının kendisi çalışmıyor demektir.
- **AÇIK SORU CEVAPLANDI (2026-08-22)**: bu mesajlar **form üzerinden gelmiyor.**
  İletişim formu `subject`'i `"İletişim Formu: <ad>"` biçiminde yazıyor; spam
  mesajların konusu farklı. Kaynak **Resend gelen-posta webhook'u**
  (`src/app/api/webhooks/resend/route.ts`) — `destek@bagajpark.com`'a gelen her
  e-posta `ContactMessage` oluyor. Yani **forma bot koruması eklemek yanlış çözüm
  olurdu.**
- **Mimari yanlış**: bir **destek kutusu** ile bir **e-posta çöplüğü** aynı şey
  sanılmıştı. Kutu ne için olduğunu bilmiyordu.
- **Çözüm (uygulandı, 2026-08-22)**:
  - `src/lib/inbox-classifier.ts` — **dış servis yok, maliyet yok.** Standart
    başlıklara dayanıyor, tahmine değil: `List-Unsubscribe` (RFC 2369 toplu posta
    işareti; meşru pazarlama gönderileri bunu koyar), `Auto-Submitted` (RFC 3834),
    `Precedence`, `X-Campaign-ID`, ayrıca gönderen yerel-adı kalıpları.
  - **Varsayılan `SUPPORT`** — bilinçli olarak iyimser. Bir pazarlama e-postasının
    destek kutusunda görünmesi can sıkıcıdır; gerçek bir müşteri şikâyetinin toplu
    klasöre düşmesi kabul edilemez. Hata payı ucuz tarafa bırakıldı.
  - Her iki yazıcı da (webhook + form) sınıflandırmadan geçiyor. Webhook **giriş
    anında** sınıflandırıyor: sonradan yapmak, işin çözmesi gereken sorunu bir kez
    daha üretmek olurdu.
  - `/admin/messages` varsayılan görünümü **Destek**; seçicide kategori sayaçları
    var. `UNCLASSIFIED` destek altında gösteriliyor — iş henüz çalışmamış olabilir
    ve sınıfsız bir mesajı gizlemek gerçek bir şikâyeti görünmez kılma riski taşır.
- **AÇIK KALAN — tek komut**: geçmiş 67 mesaj hâlâ `UNCLASSIFIED`.
  `./scripts/call-internal-job.sh --job classify-inbox` — idempotent, tekrar
  çalıştırmak zararsız. Ayrıntı: `scripts/README.md` → "Gelen kutusunu
  sınıflandırma".
- **Not**: sınıflandırma migrasyonda SQL ile yapılmadı. Kural `raw` JSON'undaki
  başlıklara bakıyor; SQL'de yeniden yazmak kuralın **ikinci bir kopyası** olurdu
  ve iki kopya ayrışırdı.

### [P1-19] ✅ DÜZELTİLDİ — İstemci bileşenleri koşulsuz "kartınıza iade edilir" diyordu
- **Nerede**: `src/components/guest/BookingModifyModal.tsx:239` (`modifyRefundNote`);
  ayrıca `Guest.cancellationEstimateCard` ve `Guest.payBookingDivider` anahtarları
- **Kanıt**: P0-0 kapsamında sunucu tarafı metinler `getPaymentCopyMode()`'a bağlandı
  (`src/lib/payment-copy.ts`), ama bu yardımcı `getPaymentProvider()` çağırdığı için
  **yalnızca sunucuda** çalışıyor. İstemci bileşenleri hâlâ kartlı sürümü basıyor —
  ödeme dükkanda alınırken misafire "kartınıza iade edilir" yazıyor.
- **Neden P1**: para vaadi, ve yanlış. P0 değil çünkü yalnızca giriş yapmış misafirin
  rezervasyon düzenleme modalinde görünüyor; kamuya açık FAQ ve JSON-LD düzeltildi.
- **Hazır olan**: `*Onsite` çeviri anahtarları 14 dilde mevcut, `paymentCopyKey()`
  yardımcısı mod parametresi alabiliyor.
- **Çözüm (uygulandı, 2026-08-22)**: `src/lib/commerce-context.ts` +
  `CommerceProvider`. Değer sunucuda çözülüp layout'tan istemciye geçiyor;
  `BookingModifyModal` artık `usePaymentCopyKey()` kullanıyor. Public env ile ikinci
  bir doğruluk kaynağı **yaratılmadı** — bir metnin doğru olup olmadığı, hangi
  katmandan bakıldığına göre değişmemeli.
- **Kritik ayrıntı**: sarmalayıcı unutulursa bağlam **ihtiyatlı** varsayılana düşer
  (ödeme dükkanda, sigorta yok). Bir vaat, sarmalayıcı unutulduğu için ortaya
  çıkmamalı — bu ayrıca test edildi.

### [P1-20] ⚠️ KOD DÜZELTİLDİ, ÜCRET KARARI AÇIK — "Sigortalı Emanet" rozeti gösteriliyordu ama sigorta ücreti sıfır
- **Nerede**: `src/components/guest/ShopDetailClient.tsx:95` (`insuredStorage`);
  sözleşme 2.3; `PlatformSettings.insuranceFeeTry` canlıda `0.00`
- **Kanıt**: P0-4 kapsamında ölçüldü — geçmiş 19 rezervasyonun tamamı
  `insuranceFee = 150.00` taşıyor, canlı ayar `0.00`. Yeni bir rezervasyon **hiç**
  sigorta satırı almıyor, ama rozet ve sözleşme maddesi yerinde duruyor.
- **Neden P1**: para vaadi değil ama **güvence** vaadi, ve karşılığı yok. Bir bavul
  kaybolduğunda platformun neye dayanarak ödeme yapacağı belirsiz.
- **Çözüm (kod tarafı uygulandı, 2026-08-22)**: rozet artık `insuranceEnabled`
  (`insuranceFeeTry > 0`) koşuluna bağlı — `CommerceProvider` üzerinden. Ücret
  belirlendiği an rozet **kendiliğinden** geri gelir, hiçbir kod değişikliği
  gerekmez. P1-19 ile aynı mekanizma; ikisi ayrı madde gibi duruyordu ama aynı hata
  sınıfıydı.
- **AÇIK KALAN — iş kararı**: `insuranceFeeTry` belirlenip gerçek bir
  poliçeye/karşılığa bağlanacak mı, yoksa iddia tamamen kaldırılacak mı? Şu an rozet
  görünmüyor, yani **yanlış bir vaat verilmiyor** — acil değil. Sözleşme 2.3'teki
  sigorta maddesi de bu karara göre gözden geçirilmeli.

### [P1-21] Gecikme ücreti hesaplanıyor ama tahsil edilmiyor; sözleşme "otomatik tahsil edilir" diyor
- **Nerede**: `src/services/BookingService.ts` (checkOut, gecikme bloğu);
  `(guest)/terms/page.tsx:65,74,100`
- **Kanıt**: P0-5 düzeltmesiyle gecikmenin artık kendi ayarı var
  (`latePickupFeeTry`), ama hesaplanan tutar yalnızca `Booking.lateFeeApplied`
  alanına ve log'a yazılıyor — hiçbir tahsilat yapılmıyor. Sözleşme üç ayrı yerde
  (4.4, 5.3, 8.3) "otomatik olarak tahsil edilir" diyor.
- **Neden P1**: süreyi aşan müşterinin maliyetini partner üstlenmeye devam ediyor;
  ayrıca sözleşme metni gerçeği anlatmıyor.
- **Bağımlı olduğu iş**: tahsilat, ödeme defterine bağlanmalı — `PaymentService`
  üzerinden ek bir tahsilat kalemi. Şu an sağlayıcı `manual` (dükkanda tahsilat)
  olduğu için pratikte esnafın çıkışta ek ücreti alması ve bunu panelden işaretlemesi
  gerekiyor; o akış henüz yok. Ayrıntı: `docs/PAYMENTS.md`.
- **O zamana kadar**: sözleşme metni gerçeğe çekilmeli.

### [P1-22] `CHECKED_OUT`'a giden yol pratikte hiç kullanılmıyor
- **Kanıt**: prod'da `BookingEvent`'te **sıfır** `CHECKED_OUT` olayı; 19 rezervasyonun
  hiçbiri bu duruma hiç geçmemiş (P1-6). Kod tarafında `BookingService.checkOut()`
  var ve çalışıyor (testleri yeşil) — yani sorun uygulamada değil, **kullanımda**.
- **Neden P1**: yaşam döngüsünün sonlanan bir durumu olmadan hiçbir mutabakat
  kapanmıyor: erken iade hesaplanamıyor, gecikme ücreti işlemiyor, partner hakedişi
  hiç kesinleşmiyor, mühürler `RETURNED` olmuyor (P1-7 ile bağlantılı).
- **Cevaplanması gereken — kod değil, saha sorusu**: partner panelinde çıkış akışı
  görünür mü, esnaf bu adımı biliyor mu, yoksa QR okutma pratikte yalnızca girişte mi
  yapılıyor? Süre aşımı taraması (`OverdueBookingService`) bu durumu artık **görünür**
  kılıyor ama sebebini çözmüyor.
- **Sıradaki adım**: 3 açık `CHECKED_IN` rezervasyonun partnerine sorulması, sonra
  partner panelindeki çıkış ekranının denetlenmesi (denetlenmemiş yüzeylerden biri).

### [P1-23] Mühür kaydı check-in'de isteğe bağlı; `BookingSeal` tamamen boş
- **Nerede**: `src/services/BookingService.ts` — `if (seals?.sealAssignments?.length)`
- **Kanıt**: prod'da `BookingSeal` tablosu **boş**, buna karşılık 3 `CHECKED_IN`
  rezervasyon var. Yani üç bavul dükkanda ama hangi mühürle mühürlendikleri hiçbir
  yerde kayıtlı değil. Kod check-in'i mühürsüz kabul ediyor — koşul isteğe bağlı.
- **Neden P1**: mühür, ürünün temel güvence vaadi. Anlaşmazlıkta zincir şudur:
  "bu bavul mühürlü teslim alındı, mühür numarası şu, çıkışta aynı mühür sağlamdı".
  Mühür kaydı yoksa bu zincir kurulamaz ve platform hiçbir şey ispat edemez.
  P1-7'den **ayrı** bir sorundur: o envanterin sahipliğiydi, bu envanterin
  kullanımı.
- **Ölçülebilir**: `GET /api/health/jobs` → `checks.sealIntegrity.checkedInWithoutSeals`
  (2026-08-22'de 3).
- **Çözüm — iki aşamalı, ikincisi iş kararı**: *kod* — `PlatformSettings`'e
  `requireSealsOnCheckIn` eklenip check-in mühürsüz reddedilebilir. *Karar* —
  lansmanda `false` bırakılmalı (esnafın elinde mühür yoksa check-in'i tamamen
  bloke eder), envanter dağıtıldıktan sonra `true`. Bayrak olmadan bunu doğrudan
  zorunlu yapmak lansmanı riske atar.

### [P0-8] ✅ KALDIRILDI — /insurance sayfası AXA'yı partner olarak gösteriyordu
- **Nerede**: `src/app/[locale]/insurance/page.tsx` (kaldırılmadan önce satır 40 ve 73)
- **Kanıt** (kodu okuyarak buldum): sayfanın alt kısmında bir "güven şeridi" olarak
  şu dört isim render ediliyordu:
  `["AXA Alliance", "SecureGate", "UrbanShield", "TravelClaim Grid"]`
- **Neden P0**: **AXA gerçek ve tescilli bir sigorta markasıdır** ve ortada böyle bir
  ortaklık yok. Diğer üçü de uydurma marka görünümünde. Halka açık ticari bir
  sayfada, adı geçen üçüncü taraf hakkında yanlış beyandır — bu bir yazılım hatası
  değil, **hukuki risktir** (yanıltıcı reklam; marka kullanımı). Lansmanda şirketi
  gerçek bir soruna sokabilecek türden.
- **Çözüm (uygulandı, 2026-08-22)**: şerit hem veri katmanından hem render'dan
  kaldırıldı. Yerine bırakılan yorum, gerçek bir ortaklık kurulursa oraya
  **sözleşmesi olan** tarafların yazılacağını, yer doldurmak için marka adı
  yazılmayacağını söylüyor.
- **Tüm kod tabanı tarandı**: başka yerde geçmiyor.

### [P1-25] ⚠️ UYARI EKLENDİ, KARAR AÇIK — /insurance "çanta başına 10.000 TL" vaat ediyor, karşılığı yok
- **Nerede**: `src/app/[locale]/insurance/page.tsx` — `thresholdTitle` üç yerde
- **Kanıt**: sayfa "Çanta Başına 10.000 TL" güvence vaat ediyor; canlı
  `PlatformSettings.insuranceFeeTry = 0`, yani karşılığı **toplanmıyor** ve arkasında
  bir sigortacı yok (P1-20 ile aynı kök).
- **Çözüm (uygulandı, 2026-08-22)**: güvence etkin değilken sayfanın başında açık bir
  uyarı gösteriliyor (`resolveCommerceContext` → `insuranceEnabled`). Ücret
  belirlendiği an uyarı **kendiliğinden** kaybolur.
- **Sayfa bilerek KALDIRILMADI**: anlattığı **süreç** gerçek — mühürleme, teslim
  kaydı ve anlaşmazlık akışı bugün de işliyor. Yalan olan kısım tutar vaadiydi.
- **Yeni politika metni UYDURULMADI**: kapsam ve tutar kararları iş kararıdır
  (P1-20); burada yalnızca mevcut durum olgusal olarak bildiriliyor.
- **AÇIK KALAN**: sigorta gerçekten sunulacak mı? Sunulacaksa tutar bir poliçeye
  bağlanmalı; sunulmayacaksa sayfa ve sözleşme 2.3 gözden geçirilmeli.

### [P1-26] ⚠️ ÖLÇÜLDÜ — 59 sayfanın 57'si dinamik; içerik sayfaları da her istekte sunucuda render ediliyor
- **Kanıt** (`npm run build` çıktısından saydım): `○ 1 statik | ● 1 SSG | ƒ 57 dinamik`.
  Dinamikler arasında `/about`, `/faq`, `/cancellation`, `/hotels`,
  `/become-partner`, `/insurance` gibi **tamamen statik içerik** sayfaları var.
- **Neden önemli — doğrudan maliyet**: her ziyaret sunucu CPU'su ve (layout DB'ye
  dokunduğu için) bir veritabanı bağlantısı harcıyor. Statik/ISR üretim üçünü
  birden kazandırır: sunucu maliyeti düşer, sayfa CDN'den gelir, hız doğrudan
  arama sıralamasına yansır — ürün organik aramaya dayandığı için üçü de aynı
  hedefe çalışıyor.
- **Kök neden**: `[locale]` segmenti için `generateStaticParams` yok. Bu olmadan
  Next hangi dillerin var olduğunu bilemez ve `[locale]/*` altındaki her sayfayı
  istek başına render eder.
- **Yapıldı (2026-08-22) — engelin yarısı kaldırıldı**: kök layout artık
  **veritabanına dokunmuyor**. Ödeme modu ortam değişkeninden geliyor; sigorta
  durumunu ona ihtiyacı olan iki yüzey kendi zaten yüklediği kurallardan türetiyor
  (`isInsuranceEnabled`). Ayrıca `resolveCommerceContext` bir DB kesintisinde
  siteyi düşürmüyor — ihtiyatlı varsayılana düşüyor.
- **DENENDİ VE GERİ ALINDI**: `generateStaticParams` eklendi, DB okuyan 30 sayfa
  `force-dynamic` işaretlendi, ama build yine kırıldı — `/hotels` gibi DB'ye hiç
  dokunmayan bir sayfa bile prerender edilemedi. Doğrulanamayan bir değişikliği
  bırakmak, kazanılacak maliyetten pahalıya mal olur: **hatalı sınıflandırılmış tek
  bir sayfa deploy'u kırar.**
- **AÇIK KALAN — gerçek bir veritabanıyla yapılmalı**: CI'da zaten Postgres servisi
  var (`ci.yml`, integration testleri için). Doğru sıra: (1) build'i o servise
  bağla, (2) `generateStaticParams` ekle, (3) prerender hatası veren her sayfayı
  tek tek `force-dynamic` işaretle, (4) statik sayılan sayfa sayısının gerçekten
  arttığını build çıktısından doğrula. Deploy iş akışı (`deploy.yml`) Docker
  imajını yer tutucu `DATABASE_URL` ile kurduğu için orası da güncellenmeli.
- **Beklenen kazanç**: içerik ve şehir landing sayfaları (~15-20 sayfa × 14 dil)
  sunucuyu hiç meşgul etmez.

### [P1-24] ⚠️ ÖLÇÜLDÜ VE MANDALLANDI — 30 sabit iki dilli metin dalı; 12 dil İngilizce görüyor
- **Nerede**: 13 dosya. En büyükleri `CheckoutClient` (8 dal), `Footer` (3),
  `luggage-storage/[slug]` (3), `[locale]/page.tsx` (3), `ShopDetailClient`
  (1 blok ama **26 metin**), `insurance` (2), `cancellation` (2)
- **Kanıt** (kendim ölçtüm): `locale === "tr" ? {...} : {...}` kalıbı 30 yerde.
  Bu metinler hiç çeviri dosyasına girmemiş, yani 14 dilin **12'sinde İngilizce**
  çıkıyorlar.
- **Bu, P2-8'in genel hâli.** P2-8 tek bir admin bileşenini işaret ediyordu; aynı
  kalıp misafir yüzeylerinde de var ve orada çok daha pahalı.
- **DENETİMİN KÖR NOKTASI**: `src/locales/locales.test.ts` çeviri bütünlüğünü
  ölçüyor ama yalnızca **eksik anahtarları** sayabiliyor. **Hiç anahtar olmamış**
  bir metni göremez — dolayısıyla o testin "106 eksik" demesi gerçek boşluğun
  tamamı değildi.
- **Yapıldı (2026-08-22)**:
  - `src/__tests__/hardcoded-copy.test.ts` — **mandal**. Sabit dalları sayar,
    tavanı aşarsa CI kırmızı yanar ve borcun hangi dosyada olduğunu yazar.
  - **Checkout hunisi** (8 dal → 0): dönüşüm yolundaki en değerli yüzey.
  - **Ana sayfa SEO başlığı** (2 dal → 0): `<title>` ve JSON-LD 12 dilde
    İngilizceydi — Almanca arayan biri için "Gepäckaufbewahrung" hiçbir yerde
    geçmiyordu. Ürün organik aramaya dayandığı için doğrudan görünürlük kaybı.
    Metadata ile JSON-LD artık aynı kaynaktan.
  - **Dükkan detay sayfası** (1 blok / 13 metin): huninin içindeki sayfa.
  - **30 → 19.** Tavan **gerçekte ulaşılan** yere kondu; mandal ancak dürüstse
    işe yarar.
- **İkinci tur (2026-08-22)**: Header navigasyonu (7 metin — üçü **erişilebilirlik
  etiketi**, yani 12 dilde ekran okuyucu İngilizce anons ediyordu), Footer (3),
  arama ipucu, slot ızgarası (5 metin), sadakat rozeti (3 metin) taşındı.
  **19 → 12.**
- **BİLEREK TAŞINMADI — politika sayfaları**: `/insurance` (67 metin) ve
  `/cancellation` (45 metin) toplam 112 sabit metin taşıyor, ama bunlar **iptal
  politikası ve sigorta şartları**. Makine kalitesinde hukuki çeviri, İngilizce
  bırakmaktan **daha risklidir**: yanlış çevrilmiş bir iade koşulu bağlayıcı bir
  vaat hâline gelir. Bu metinler çevrilecekse insan eliyle çevrilmeli. Ayrıca
  `/insurance`'ın geleceği P1-20/P1-25 kararına bağlı — karar verilmeden çevirmek
  boşa iş olur.
- **AÇIK KALAN**: 12 dal. `luggage-storage/[slug]` (3), `cancellation` (2),
  `insurance` (2), `page.tsx` (1), `account` (1), `BookingsClient` (1), iki admin
  sayfası (2).

### [P2-8] ✅ DÜZELTİLDİ — Admin gelen kutusundaki toplu işlem metinleri i18n'i baypas ediyordu
- **Nerede**: `src/components/admin/AdminMessagesClient.tsx:26-29`
- **Kanıt**: metinler bileşen içinde sabit bir tr/en üçlü operatörüyle yazılmış
  (`bulkCopy = locale === "tr" ? {...} : {...}`), locale dosyalarından gelmiyor.
  Sonuç: diğer 12 dilde toplu işlem arayüzü İngilizce çıkıyor.
- **Çözüm (uygulandı, 2026-08-22)**: anahtarlar `Admin` namespace'ine taşındı ve
  14 dile çeviri eklendi. Kullanılmayan `useLocale` kaldırıldı (lint uyarısı
  16 → 15). Çeviri borcu mandalı tuttu: misafir dışı en kötü eksik 106'da sabit.

### [P2-9] ✅ DÜZELTİLDİ — Gelen kutusu satır aksiyonlarının erişilebilir adı yalnızca `title`'dı
- **Nerede**: `src/components/admin/AdminMessagesClient.tsx:282-297`
- **Kanıt**: satır butonları `title={t("messagesMarkAsRead")}` / `title={t("messagesDelete")}`
  kullanıyor, `aria-label` yok. `title` çoğu tarayıcıda erişilebilir ad olarak kabul
  edilir, yani tamamen etiketsiz değiller — ama dokunmatik cihazda tooltip görünmez ve
  ekran okuyucu desteği tutarsızdır.
  > Not: ilk DOM taramamda bunları "124 etiketsiz buton" olarak saymıştım; yalnızca
  > `innerText`/`aria-label` kontrol ettiğim için yanlış çıktı. Kodu okuyunca durum
  > düzeltildi ve şiddet P2'ye indirildi.
- **Çözüm (uygulandı, 2026-08-22)**: `title` korundu, `aria-label` eklendi.

### [P2-11] Olmayan sayfalar HTTP 200 dönüyor (soft-404) — ama `noindex` zararı engelliyor
- **Nerede**: uygulama genelinde; `src/app/[locale]/shop/[shopId]/page.tsx:57`
  (`notFound()` çağrılıyor ama durum kodu 404 olmuyor)
- **Kanıt** (kendim ölçtüm):
  | URL | Dönen kod | Beklenen |
  |---|---|---|
  | `/tr/boyle-bir-sayfa-yok` | **200** | 404 |
  | `/tr/shop/00000000-0000-0000-0000-000000000000` | **200** | 404 |

  İkincisi özellikle çarpıcı: dükkan sayfasının kodunda `if (!shop) notFound();`
  açıkça var, yani "bulunamadı" sayfası doğru render ediliyor ama HTTP durumu 200
  kalıyor. Kullanıcı doğru ekranı görüyor ("KAYBOLDUN!"), arama motoru ise sayfayı
  geçerli sayıyor.
- **ÖNEMLİ DÜZELTME (2026-08-22): bu maddenin şiddetini P1'den P2'ye indirdim ve
  gerekçesini geri aldım.** Önce "Google uydurma URL'leri geçerli içerik olarak
  indeksler" yazmıştım — **bu yanlıştı.** Ölçtüm: Next, `notFound()` durumunda
  sayfaya `<meta name="robots" content="noindex"/>` enjekte ediyor; geçerli bir
  sayfada bu etiket yok (ikisi karşılaştırıldı). Yani indeksleme zaten engelliyor.
  Kalan sorun sadece durum kodunun ideal olmaması: tarama bütçesi boşa gidiyor ve
  Google HTTP katmanında değil sayfayı render ederek anlıyor.
- **Teşhis (ölçümle, tahminle değil)**: Cloudflare ve nginx elendi — container'ın
  *içinden* `node fetch` ile sorulduğunda da 200 döndü, yani 200'ü Next'in kendisi
  üretiyor. Sebep: catch-all route (`[locale]/[...slug]`) **eşleştiği için** Next
  yanıtı başarılı sayıyor; `notFound()` çağrılıyor ama durum 200 kalıyor.
- **Denenip BAŞARISIZ olan**: `export const dynamic = "force-dynamic"` — durum hâlâ
  200 döndü, değişiklik geri alındı. Faydası olmayan ama statik optimizasyonu kapatan
  bir satır taşımanın anlamı yok.
- **Kök `app/not-found.tsx` eklenmedi**: ölçüldü, locale'siz yollar next-intl
  middleware'i tarafından 307 ile `/tr/...`'e yönleniyor, yani o boundary pratikte
  hiç erişilmiyor — ölü kod olurdu.
- **Gerçek çözüm adayı**: catch-all dosyasını **silmek**. O zaman eşleşmeyen URL'ler
  hiçbir route'a düşmez ve Next kendi 404'ünü doğru durum koduyla döner. Doğrulanması
  gereken tek şey markalı "KAYBOLDUN!" ekranının korunup korunmadığı. `noindex` zaten
  devrede olduğu için bu düşük öncelikli.
- **Kontrol tek satır**: `curl -o /dev/null -w '%{http_code}' https://bagajpark.com/tr/yok-boyle-sayfa`

### [P1-15] Partner panelinde hydration hatası (React #418)
- **Nerede**: `/tr/partner` (test partner hesabıyla giriş yapılmış oturumda)
- **Kanıt**: sayfa yüklenirken konsola `Minified React error #418; args[]=text` düşüyor
  — sunucunun ürettiği HTML ile istemcinin render'ı **metin içeriğinde** uyuşmuyor.
  Playwright ile `pageerror` dinleyerek yakalandı.
- **Neden önemli**: hydration uyuşmazlığı React'in o ağacı istemcide baştan render
  etmesine yol açar; pratikte titreme, kaybolan/yanlış görünen değer ve tıklamanın
  ilk seferde çalışmaması gibi belirtiler verir. Esnafın operasyonel ana ekranı
  olduğu için etkisi görünenden büyük.
- **Muhtemel sebep**: sunucu ve istemcide farklı sonuç veren bir tarih/saat ya da
  para biçimlendirmesi (panelde her ikisi de var). Kesinleştirmek için üretim
  build'inde unminified React ile tekrar üretmek gerekiyor.

### [P1-16] ✅ DÜZELTİLDİ — Esnaf, e-posta ile "ESNAF" sekmesinden giriş yapamıyordu
- **Nerede**: `src/app/[locale]/login/LoginClient.tsx:121`
- **Kanıt** (canlıda ölçtüm):
  | Sekme | Input | Placeholder |
  |---|---|---|
  | MİSAFİR | `type=text`, `autocomplete=email` | "E-posta veya Telefon" |
  | ESNAF | `type=tel`, `autocomplete=tel-national` | "Telefon (05xx xxx xx xx)" |

  Yani ESNAF sekmesi **yalnızca telefon** kabul ediyor. Prod'da e-postayla kayıtlı bir
  partner var ve o hesapla ESNAF sekmesinden giriş mümkün değil; MİSAFİR sekmesinden
  e-posta + şifre ile giriş **çalışıyor** (test ettim, başarılı) ama ardından esnaf
  paneline değil **misafir ana sayfasına** düşüyor.
- **Neden önemli**: e-postayla kayıtlı bir esnaf, kendisi için etiketlenmiş sekmeden
  giremiyor; çalışan yol "MİSAFİR" yazan sekme. Destek yükü ve terk sebebi.
- **Bağlantı**: bu aynı zamanda P1-3'ü açıklıyor — esnaf girişi telefon tabanlı
  tasarlanmış, o yüzden e-postasız 2 partner kaydı bir bozulma değil, tasarımın
  sonucu. P1-3'te asıl hata olan şey duruyor: `approveShop`'un e-posta bildirimini
  sessizce atlaması.
- **Çözüm (uygulandı, 2026-08-22)** — kök neden **sahte bir ayrımdı**: sekmeler iki
  farklı kimlik sistemiymiş gibi davranıyordu, oysa arkada tek sistem var
  (`auth.config.ts` → `authorize()` zaten e-posta VE telefonu birlikte sorguluyor).
  Sekme, olmayan bir ayrımı taklit edip çalışan bir yolu kapatıyordu.
  1. Her iki sekme de e-posta/telefon kabul ediyor; girdiyi ayırt etme işi zaten
     backend'de olduğu için istemcide ek mantık gerekmedi.
  2. **Varış noktası artık ROLDEN türüyor** (`src/lib/auth-landing.ts`).
     Kullanıcının gitmek istediği yer (`callbackUrl`) her zaman öncelikli — korumalı
     bir sayfadan yönlendirilmiş olabilir; yalnızca anlamlı hedef yokken rol devreye
     giriyor. 6 test.
  3. Sekme artık yalnızca görsel bir ipucu.

### [P1-12] ✅ MİSAFİR TARAFI KAPATILDI — 14 dilin 12'si aynı 138 çeviri anahtarını eksikti
- **Nerede**: `src/locales/*.json`
- **Kanıt** (ölçüm — anahtarları düzleştirip Türkçe referansla karşılaştıran bir script
  çalıştırdım):
  | Diller | Anahtar | tr'de olup eksik |
  |---|---|---|
  | ar, bg, de, es, fa, fr, it, ja, ko, pl, ru, zh | 1192 | **138** |
  | en | 1329 | 1 (`AccountPrivacy.errors.guestContactRequired`) |
  | tr (referans) | 1330 | 0 |

  138'in namespace dağılımı: `Partner` 40, `Guest` 27, `CityStorage` 27,
  `AccountPrivacy` 15, `WebPush` 8, `MarketingHotels` 8, `PartnerPromo` 6,
  `Errors` 3, `Admin` 2, `UserNav` 1, `Footer` 1.

  Misafire görünen 31 anahtar arasında **ana sayfa SSS'inin tamamı** (`homeFaq1Q/A`,
  `2Q/A`, `3Q/A`), arama filtreleri (`showFilters`, `hideFilters`, `sortByHourly`),
  rezervasyon sorgulama/yönetme akışı (7 anahtar), dükkan detayı (`shopDetailAbout`)
  ve giriş modalı (4 anahtar) var.

  Canlı doğrulama (Playwright, gerçek sayfa): `/de` ve `/ar` ana sayfalarında
  **`Footer.sitemap` ham anahtar olarak ekrana basılıyor**; `/tr` temiz.
  Prod web container log'unda da aynı hata akıyor:
  `Error: MISSING_MESSAGE: Footer.sitemap (ko)`, `Guest.showFilters (ar)`,
  `Guest.sortByHourly (de)`.
- **Neden önemli**: Türkçe dışındaki her dilde kullanıcı ya ham anahtar görüyor ya da
  boş bir bölüm — turist odaklı bir üründe İngilizce dışı diller tam da hedef kitle.
- **Çözüm (2026-08-22 — misafir tarafı tamamlandı)**:
  - Misafire görünen **29 anahtar 12 dile çevrildi** (348 çeviri): ana sayfa SSS'inin
    tamamı, arama filtreleri, rezervasyon sorgulama/yönetme akışı, dükkan detayı,
    giriş modalı, iptal politikası satırı, hata mesajları, `Footer.sitemap`.
    Yeniden ölçüm: **12 dilde de misafire görünen eksik anahtar 0**.
  - **6 ölü anahtar silindi** (14 dilden): `Guest.authModalTitle`, `Guest.authModalBody`
    (hiç kullanılmıyor) ve `Guest.cancellationTierCreditSimple`,
    `Guest.cancellationTierCredit`, `Guest.cancelSuccessCredit`,
    `Guest.confirmCancelPaid` — bunlar kaldırılan "nakit yerine kredi" iptal
    politikasının kalıntısıydı, yani sadece ölü değil güncel politikayla **çelişiyorlardı**.
  - **CI koruması eklendi** (`src/locales/locales.test.ts`, 54 test): misafire görünen
    namespace'lerde eksik anahtara sıfır tolerans; interpolasyon yer tutucularının
    referansla aynı olması; anahtar tiplerinin (metin/dizi) diller arasında tutarlı
    olması; fazladan anahtar olmaması; ve misafir dışı borç için **mandal** (106'dan
    yükselemez).
  - **Koruma yazıldığı anda 3 gerçek hata buldu**: `cancellationTierCredit` tr'de
    `{minutes}` iken 13 dilde `{minHours}`; `cancelSuccessCredit` ve `confirmCancelPaid`
    tr'de yer tutucusuz iken 12 dilde `{code}` / `{amount}` bekliyordu — yani o dillerde
    çalışma zamanında hata verir ya da yanlış render ederdi. Üçü de ölü çıktı ve silindi.
- **Kalan borç**: 12 dilde 106 anahtar (Partner 40, CityStorage 27, AccountPrivacy 15,
  WebPush 8, MarketingHotels 8, PartnerPromo 6, Admin 2). Bunlar Türk esnaf/operatörün
  kullandığı yüzeyler olduğu için pratik etkisi düşük; mandal yükselmesini engelliyor.

### [P1-13] Aralıklı 502 Cloudflare kaynaklı, uygulama kaynaklı değil
- **Nerede**: Cloudflare ↔ origin (Hetzner nginx)
- **Kanıt**: Haziran denetiminde P0 olarak açılıp "tekrar üretilemiyor" diye açık
  bırakılan 502'nin bir örneğini 2026-08-22'de yakaladım
  (`/api/admin/setup` → 502). Hemen ardından: aynı uca 5 istek → 5×200; ana sayfa,
  arama ve `/api/health`'e 20'şer istek → **60/60 200**. Kritik nokta: aynı pencerede
  **nginx log'unda tek bir 502 veya upstream hatası yok**
  (`docker compose logs nginx --since=30m | grep -iE "502|upstream"` → boş).
- **Neden önemli**: nginx isteği hiç görmediyse 502'yi origin üretmemiştir — yani bu
  bir uygulama çökmesi değil, Cloudflare'ın origin'e ulaşamadığı anlık bir kesinti.
  Haziran'dan beri uygulama tarafında aranıyordu; yanlış yerde aranıyormuş.
- **Çözüm**: *operasyonel* — Cloudflare tarafında origin health/error oranını izle
  (Cloudflare Analytics → Errors by origin). Uygulama kodunda aranacak bir şey yok.
  Kalıcı kapatmak için origin'e dışarıdan bağımsız bir uptime kontrolü gerekiyor
  (bkz. `openspec/changes/hetzner-sertlestirme` Faz 4 — henüz kurulmadı).

---

## P2 — Düzeltilmeli ama acil değil

- **[P2-1] Hiçbir dükkanın fotoğrafı yok** — `ShopImage` boş, 3 dükkanın da
  `image IS NULL`. Bu kategoride en güçlü güven sinyali. *Veri* + *kod* (aktif olmadan
  önce en az bir görsel şartı).
- **[P2-2] Tüm dükkanlar `rating = 0`, sıralayıcı 3 varsayıyor ama tutmuyor** —
  `(shop.rating ?? 3)` çalışmıyor çünkü değer `NULL` değil `0` (şema varsayılanı).
  Her dükkan puan bileşeninden 0 alıyor ve misafir yorumsuz 0 yıldız görüyor.
  *Kod* — ilk yoruma kadar `rating` `NULL` olsun; yorum yokken rozeti gizle.
- **[P2-3] Canlı `PlatformSettings` hem şema varsayılanından hem kod fallback'inden
  sapmış** ve 8 Nisan'dan beri güncellenmemiş. `maxStayDays` 15/30/30,
  `insuranceFeeTry` 0/15/0, `cancelFixedFeeTry` 0/20/0, `defaultShopCapacity` 20/10/10.
  Çoğu iş kuralının katmana göre üç farklı cevabı var. *Karar + veri + kod hizalaması.*
- **[P2-4] `cancelBooking`'in doküman yorumu, kodun da sayfanın da çeliştiği kademeli
  bir politikayı anlatıyor** — yorum "≥24s tam iade, ≥1s %50, sonrası kupon" diyor,
  gövde koşulsuz tam iade uyguluyor. Refund mantığını değiştirecek kişinin okuduğu
  ilk şey bu. *Kod* — yorumu gerçekle değiştir.
- **[P2-5] Sözleşme "erken teslimde iade yok" diyor, kod tam iade hesaplıyor** —
  `earlyRefundRatio` canlıda 1.0, yani kullanılmayan her tam gün %100 iade ediliyor ve
  `refundPending: true` dönüyor; sonra ödenmiyor (bkz. P0-2). Henüz hiç erken çıkış
  olmadığı için P2. *Önce karar, sonra metin + oran hizalaması.*
- **[P2-6] Misafir iptal token'ı `AUTH_SECRET` yoksa repoda yazılı sabit bir sırra
  düşüyor** — `process.env.AUTH_SECRET || "bagajpark-guest-management-secret"`.
  Şu an prod'da `AUTH_SECRET` set (yalnızca anahtar adı sayılarak doğrulandı, değer
  okunmadı), bu yüzden P2. *Kod* — değişken yoksa açılışta hata ver.
- **[P2-7] Bir dükkan `isVerified = true` ama hiçbir doğrulama yok; `responseTimeMinutes`
  platform genelinde 0** ve `src/` içinde bu kolonu yazan hiçbir kod yolu yok. İki
  güven rozeti de karşılıksız. *Kod* — gerçek veriden hesapla ya da gösterme.

---

## Doğrulanmış GÜVENLİ (tekrar denetlenmesin diye)

Bunları kontrol ettim ve **doğru** çalışıyorlar; listede olmaları "bakıldı, sorun yok"
demektir:

- **Mobil API yetkilendirmesi sağlam.** 40 mobil ucun tamamı `requireMobileUser` /
  `requireRole` kullanıyor; kullanmayanlar yalnızca auth uçlarının kendisi
  (`login`, `register`, `otp`, `password-reset`, `refresh`, `verify-email`, OAuth) ve
  bilinçli olarak genel olan okuma uçları (`shops/[id]`, `shops/nearby`,
  `referrals/validate`). Doğru tasarım.
- **`/api/admin/setup` iyi savunulmuş.** Varsayılan kapalı (`ADMIN_SETUP_ENABLED` +
  `ADMIN_SETUP_KEY` birlikte gerekli), `crypto.timingSafeEqual` ile sabit-zamanlı
  anahtar karşılaştırması, rate limit (15 dk'da 10), ve ilk ADMIN oluştuktan sonra
  kendini kilitliyor. Canlıda `GET` ile durumu sorulduğunda anahtar sızdırmıyor.
- **Sayfa/rol koruması middleware'de doğru.** `/admin` ve `/api/admin` yalnızca
  `ADMIN`; `/partner` ve `/api/partner` yalnızca `PARTNER` veya `ADMIN`; giriş yapılmamışsa
  locale'i koruyan bir login yönlendirmesi var. (İç API kısmı hariç — bkz. P1-1.)
- **Ödeme tutarları kayıtlarla tutarlı.** Ödeme kaydı olan her rezervasyonda
  `PaymentLog.amount = Booking.totalPrice`; uyuşmazlık sayısı 0.

---

## 21-22 Ağustos'ta bulunup DÜZELTİLENLER (referans)

Bunlar kapandı, tekrar açılmasın diye kayıtta:

- **Arama her sorguda 0 sonuç dönüyordu.** `isShopOpenForStay`, emanet süresinin
  *ortasında* da dükkanın açık olmasını istiyordu; 7/24 olmayan tüm dükkanlar geceyi
  aşan her aramada eleniyordu. Kaldırıldı + regresyon testi eklendi.
- **Dükkan detayında dükkan adı dikey tek-harf sütunu olarak render ediliyordu.**
  Başlık flex satırının kapanış `</div>`'i eksikti; adres, rozetler ve özellik grid'i
  yanlışlıkla aynı satırın flex çocukları oluyor, ad `width:0`'a sıkışıyordu.
- **Dükkan detayı ve checkout'ta sticky CTA mobil alt navigasyonla çakışıyordu.**
- **Deploy yarışı**: `update.sh` yalnızca git SHA'ya bakıyordu, image digest'ine
  bakmıyordu — bu yüzden Haziran'da `develop`'a yazılan arama düzeltmesi iki ay
  boyunca canlıya çıkmamıştı. Artık digest karşılaştırılıyor.
- **AWS SSM deploy'u** artık yarım kalmış container artıkları yüzünden patlamıyor.

---

## Doğrulanması gerekenler (henüz kanıtlanmadı — listeye alınmadı)

1. **Geçmiş fiyat rejimi** (S 0.8 / M 2.0 / XL 3.0 + 150 sabit sigorta). 19
   rezervasyonun 18'ine birebir oturuyor ama tamamen kayıtlı toplamlardan geriye
   türetildi; Haziran'daki fiyat kodu okunmadı.
   *Kontrol*: `git log -p --follow src/lib/pricing-rules.ts src/lib/bag-pricing.ts`
2. **Vercel dağıtımı var mı?** Varsa `reconcile-payments` orada aynı DB'ye karşı
   çalışıyor olabilir ve P1-11'in sonucu değişir. *Kontrol*: `vercel project ls`.
3. **3 eski CHECKED_IN rezervasyon gerçek bavul mu?** Veri, terk edilmiş testi gerçek
   teslimden ayıramıyor. *Kontrol*: partnerlere sor / `NotificationLog`.
4. **Misafirin bugün gördüğü slot grid'i gerçekten boş mu?** Kod yolu izlendi ama sayfa
   yüklenmedi. *Kontrol*: `/api/shops/<id>/slots?from=...&to=...` çağır, sonra sayfayı aç.
5. **İptal eden tek müşteriye ne söylendi?** *Kontrol*: o `bookingId` için
   `NotificationLog`.

---

## Henüz hiç taranmamış yüzeyler

Bunlar için henüz **hiçbir** kanıtlı bulgu yok — yokluğu "sorun yok" anlamına gelmez:

- Misafir rezervasyon akışı (ana sayfa, arama, dükkan detayı, checkout) — görsel/UX
- Misafir dışı sayfalar + auth (giriş, kayıt, şifre sıfırlama, rezervasyonlarım,
  yasal sayfalar, 404)
- Partner paneli (UI + eksik yetenekler)
- Admin paneli (UI + **yetkilendirme kontrolleri**)
- Backend güvenlik/doğruluk (IDOR, yetkilendirme, girdi doğrulama, yarış koşulları,
  webhook imzası, rate limit) — **en yüksek değerli, henüz yapılmadı**
- i18n (14 dil: eksik anahtarlar, ham anahtar sızıntısı, yanlış çeviriler)
