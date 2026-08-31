# UI/UX + PWA denetimi

Bu dosya SÜRÜYOR. Amaç: her yüzeyi tek tek gezip kanıtlı hataları yazmak, hangi
alana **henüz bakılmadığını** görünür tutmak. Bulgu kapandıkça satırı `DÜZELTİLDİ`
yapın, silmeyin — neyin neden değiştiği sonraki turda gerekiyor.

Yöntem: canlıda (bagajpark.com) tarayıcıyla gezmek + DOM ölçmek. "Sanırım şöyle"
yazılmaz; ölçüm yazılır.

**Regresyon taraması:** `node scripts/ux-sweep.mjs` — ayrıca **modal odak
davranışını** (aç → odak içeri, Escape → kapan) ve %200 koşulunda
**düşmanca içerik** deniyor (metinler 72 karakterlik boşluksuz bir kelimeyle
değiştiriliyor). Gerçek veriyle ölçmek yetmiyor: uzun bir dükkan adı yarın
veritabanına girdiğinde düzenin dayanacağını bugünden bilmek gerekiyor. — kapatılan hataların geri
gelmediğini tek komutla ölçer (yatay kaydırma, tek `main`, tek `h1`, başlık
atlaması, etiketsiz `nav`, ekran okuyucuya giden İngilizce metin, dokunma
hedefi ≥24×24; normal boyut ve %200 metin). Bozulursa çıkış kodu 1.
**2026-08-31 itibarıyla 14 sayfa × 2 koşul = 28 kontrol.** Kapsam: TR/DE/FR/FA, ana sayfa · arama · sigorta · SSS · blog · blog yazısı · şehir · dükkan · checkout.
Kullanımı `scripts/README.md`'de.

Ayrıca dar ekranlar ölçüldü — **320 px** (iPhone SE / eski Android) ve
**360 px** (yaygın Android): ana sayfa, arama ve checkout üçünde de yatay
kaydırma yok. Başlıktaki esneme düzeltmeleri (küçülebilir logo, kırpılabilir
giriş düğmesi) dar ekranlarda da tutuyor.

> **`git commit` STAGING'DEKİ HER ŞEYİ ALIR — pahalıya mal oldu (2).**
> 2026-08-31'de üç dosyalık bir düzeltme commit'ledim ve **34 dosya** gitti:
> staging alanında diğer agent'in yarım auth/JWT çalışması duruyordu (biri
> `git add -A` yapmış) ve `git commit` onları da aldı. Yani başka bir agent'in
> bitmemiş işini ben prod'a gönderdim. Tesadüfen sağlamdı (typecheck temiz,
> 814 test geçti, CI yeşil) ama olmayabilirdi.
> Kural: **`git commit -- <yollar>`** kullanın; pathspec verilen bir commit,
> staging'de ne olursa olsun yalnızca o yolları alır. `git add` + `git commit`
> ikilisi, eş zamanlı çalışılan bir repoda güvenli değil.
>
> **`git add -A <dizin>` DE AYNI TUZAK — bu sefer main KIRMIZI oldu (3).**
> 2026-08-31, `ef9c2cc`: 22 sayfalık bir meta-etiket düzeltmesini `git add -A
> src/app` ile hazırladım. O dizinde diğer agent'in **commit'lenmemiş** XSS
> düzeltmesi duruyordu (JSON-LD kaçışı, 7 dosyada `serializeJsonLd` çağrısı) ve
> commit onları da aldı — ama çağrılan `src/lib/json-ld-script.ts` `src/app`
> altında olmadığı için commit'e girmedi. Sonuç: `Cannot find module
> '@/lib/json-ld-script'`, dokuz dosyada typecheck hatası, **CI kırmızı**.
> Önceki iki vakada iş tesadüfen sağlamdı; bu üçüncüsünde değildi.
> Üretim korundu, çünkü deploy `verify`e `needs` ile bağlı: kırmızı commit
> yayına çıkmadı ve diğer agent eksik dosyayı bir sonraki commit'te gönderince
> main toparlandı.
> Kural bir adım daha sertleşiyor: **`git add -A` ve `git add <dizin>` hiç
> kullanılmaz.** Dosyalar tek tek yazılır, ya da doğrudan
> `git commit -- <yol> <yol>` verilir. Bir dizin, o an içinde ne olduğunu
> bilmediğiniz bir kümedir.
>
> **PAYLAŞILAN DOSYA UYARISI — pahalıya mal oldu.** `src/locales/*.json`
> dosyalarını iki agent birden düzenliyor. Bir betikle dosyanın TAMAMINI okuyup
> yeniden yazarsanız, diğer agent'in o an **commit'lenmemiş** anahtarları da
> sizin commit'inize girer. 2026-08-31'de tam bu oldu:
> `Admin.platformSettingsCheckInGrace` anahtarı `de`/`fr`'ye sızdı ama `tr`'de
> olmadığı için `locales.test.ts` CI'da kırıldı ve deploy durdu.
> Kural: dil dosyasına dokunan her commit'ten önce
> `git diff --cached src/locales` çıktısını okuyun; yalnızca kendi
> anahtarlarınız olmalı.

> **Numara aralıkları — çakışmayı önlemek için.** Bu dosyaya aynı anda birden
> fazla agent yazıyor ve ikisi de sıradaki numarayı alınca üç kez çakışma oldu
> (iki `#10`, iki `#16`…). Bundan sonra: **1–99 mobil/PWA/erişilebilirlik
> hattı**, **101+ harita ve esnaf/check-in hattı**. Numara ne olursa olsun,
> bulguyu kapatan commit hash'i satırda yazılı olmalı — asıl kimlik o.

---

## Ne bekliyor — kime bağlı

Kapanmış bulgular aşağıdaki tabloda; **açık kalanlar** burada, kime bağlı
olduğuna göre. Bu blok, kimin ne yapması gerektiğini tek bakışta görmek için.

**Senin kararını bekleyenler** (uygulanabilir durumda, ölçümleri hazır):

| # | Konu | Neden kendi başıma yapmadım |
|---|---|---|
| 48 | Web push uçtan uca ölü; açılırsa checkout'ta izin ister | Kullanıcıya bildirim göndermek ürün kararı |
| 42 | Çevrimdışı kalınca markasız tarayıcı hatası | Çözüm bir service worker gerektiriyor; öncekini bilerek kaldırmışsınız |
| 17 | Birincil butonlarda beyaz yazı **3.56:1** (gerekli 4.5) | Markanın ana tonunu koyulaştırmak gerekiyor |
| 18 | İkincil gri metin **2.52:1**, 406 kullanım | Tek satırlık token değişimi ama tipografi tonunu değiştiriyor |
| 15 | Checkout'ta ekranın %31'i sabit çubuk | Çözüm mobil alt menüyü gizlemek — gezinme davranışı değişir |
| 12 | Çerez paneli mobilde ana eylemi örtüyor | Hukuki metin; daraltma kararı senin |
| 19 | PWA her açılışta Türkçe | `localeDetection` SEO'yu ve tüm kullanıcıları etkiler |

**Başka agent'in alanındaydı, sonra uygulandı** (2026-08-31): #37 ve talep
haritasındaki dokunma hedefi. Gerekçe: her iki dosya da turlarca sabitti
(son commit'leri bana aitti), değişiklikler tek sınıf/tek öznitelik ve
özelliğin davranışına — işleyiş, veri, akış — hiç dokunmuyor. Yalnızca
erişilebilirlik hijyeni. Yanlış bulunursa geri alması tek satır.

**Bende açık kalan** — ama sebebi ölçüldü, çözümü 15'e bağlı:

| # | Konu | Ölçülen sebep |
|---|---|---|
| 14 | Checkout'ta görünen satır 0, özet "1 Valiz" diyor | Seçili satır (M/L) ilk açılışta yapışkan çubuğun ARKASINDA |

**Hiç ölçülemeyenler:** giriş gerektiren bütün yüzeyler (hesabım,
rezervasyonlarım, partner paneli, admin ekranları) ve gerçek cihazda PWA
kurulum akışı. Hesap açmak ve parola girmek yapabileceğim işler değil;
tarayıcıda oturumu sen açarsan aynı sekmeden devam edilebilir.

---

## Son durum — 2026-08-31

| # | Bulgu | Yüzey | Durum |
|---|---|---|---|
| 1 | Takvim popup'ının alt yarısı görünmüyor | Ana sayfa (web) | ✅ DÜZELTİLDİ (`ae8dfa1`) |
| 2 | İngilizcede tarih "01:00 P" diye kesiliyor | Arama paneli | ✅ DÜZELTİLDİ (`ae8dfa1`) |
| 3 | Harita saniyelerce bembeyaz açılıyor | Arama (web+mobil) | ✅ DÜZELTİLDİ (`ae8dfa1`) |
| 4 | Bildirim açma düğmesi SONSUZA KADAR takılıyor | Hesap / PWA | ✅ DÜZELTİLDİ |
| 5 | Temizlik kodu push worker'ını da silecekti | PWA | ✅ DÜZELTİLDİ |
| 6 | İki ayrı manifest, biri ölü | PWA | ✅ (başka agent `3929ad5` ile sildi) |
| 7 | Manifest 404 veren ekran görüntüleri ilan ediyor | PWA | ✅ DÜZELTİLDİ (referans kaldırıldı) |
| 8 | İngilizcede ana sayfa arama kutusu karttan taşıyor | Ana sayfa | ✅ DÜZELTİLDİ (`86887b3`, diğer agent) |
| 9 | Başlık menüsü bağlantıları 12 px, footer 17 px yüksek | Web + mobil | ✅ DÜZELTİLDİ |
| 10 | FR mobilde sayfa 33 px, DE'de 13 px yana kayıyor | Mobil başlık | ✅ DÜZELTİLDİ |
| 11 | Mobil aramada TEK BİR sonuç kartı bile görünmüyor | Mobil arama | ✅ DÜZELTİLDİ |
| 12 | Çerez paneli mobilde ana eylemi tamamen örtüyor | Mobil (her sayfa) | ⏳ AÇIK |
| 14 | Checkout'ta görünen valiz satırı 0, özet "1 Valiz" diyor | Mobil checkout | ⏳ AÇIK |
| 15 | Checkout'ta ekranın %31'i sabit çubuk; 3 valiz tipinden 1'i görünüyor | Mobil checkout | ⏳ AÇIK |
| 16 | Almancada sayfa 13 px yana kayıyor — panel başlığı taşıyor | Mobil (BottomSheet) | ✅ DÜZELTİLDİ |
| 17 | Birincil butonlarda beyaz yazı 3.56:1 — WCAG AA'nın altında | Her sayfa | ⏳ KARAR BEKLİYOR |
| 18 | İkincil gri metin 2.52:1 — 406 yerde | Her sayfa | ⏳ KARAR BEKLİYOR |
| 19 | PWA her açılışta Türkçe açılıyor | PWA | ⏳ AÇIK |
| 20 | `offline.html` ölü dosya | PWA | ✅ SİLİNDİ |
| 21 | **GÜVENLİK**: `callbackUrl` ters bölüyle açık yönlendirme | Giriş | ✅ DÜZELTİLDİ |
| 22 | Hareket azaltma tercihi framer-motion'da uygulanmıyor | Her sayfa | ✅ DÜZELTİLDİ |
| 23 | %200 metin büyütmede ana sayfa 93 px yana kayıyor | Mobil | ✅ DÜZELTİLDİ (93→0) |
| 24 | %200'de checkout 200 px kayıyor — valiz adımlayıcısı | Mobil checkout | ✅ DÜZELTİLDİ (200→0) |
| 25 | %200'de sigorta sayfası 76 px kayıyor | Mobil | ✅ DÜZELTİLDİ (76→0) |
| 26 | %200'de dükkan sayfası 17 px kayıyor | Mobil | ✅ DÜZELTİLDİ |
| 27 | %200'de DE sigorta 28 px, FR ana sayfa 7 px kayıyor | Mobil | ✅ DÜZELTİLDİ (ikisi de 0) |
| 28 | Arama sayfasında mobilde HİÇ `h1` yok | Ekran okuyucu | ✅ DÜZELTİLDİ |
| 29 | Footer başlıkları `h2→h4` atlaması yapıyor (4 sayfa) | Ekran okuyucu | ✅ DÜZELTİLDİ |
| 30 | Sayfa içinde iç içe `main` (25 dosya) | Ekran okuyucu | ✅ DÜZELTİLDİ |
| 31 | Etiketsiz `nav` (footer yasal bağlantılar) | Ekran okuyucu | ✅ DÜZELTİLDİ |
| 32 | Takvim kontrolleri her dilde İNGİLİZCE konuşuyor | Ekran okuyucu | ✅ DÜZELTİLDİ |
| 33 | Harita kontrolleri her dilde İNGİLİZCE konuşuyor | Ekran okuyucu | ✅ DÜZELTİLDİ |
| 34 | PWA ikonu `maskable` ilan ediyor ama güvenli bölgeyi aşıyor | PWA | ✅ DÜZELTİLDİ |
| 35 | İletişim formunun üç alanının erişilebilir adı yok | Form | ✅ DÜZELTİLDİ |
| 36 | Rezervasyon sorgulamada `autocomplete` yok | Form | ✅ DÜZELTİLDİ |
| 37 | Prelaunch formlarında `autocomplete` yok (2 dosya) | Form | ✅ DÜZELTİLDİ |
| 38 | Blog yazısında `h2→h4` + çıkış bağlantısı 115×16 | Blog | ✅ DÜZELTİLDİ |
| 39 | Kısa etiketli dillerde footer/çip hedefleri dar | FA/JA | ✅ DÜZELTİLDİ |
| 40 | "İptal Politikası" 5 dilde sadece "İptal"e düşmüş | i18n | ✅ DÜZELTİLDİ |
| 41 | Footer'da İKİNCİ şehir çipi listesi eşiğin altında | FA | ✅ DÜZELTİLDİ |
| 42 | Çevrimdışı kalınca tarayıcının dinozor sayfası çıkıyor | PWA | ⏳ KARAR BEKLİYOR |
| 43 | E-posta kabuğu dili söylemiyordu (`lang` yok) | E-posta | ✅ DÜZELTİLDİ |
| 44 | E-postada başarı tonunda beyaz yazı 3.30:1 | E-posta | ✅ DÜZELTİLDİ |
| 45 | Yazdırılan fişte iptal/geri/yazdır düğmeleri de basılıyor | Yazdırma | ✅ DÜZELTİLDİ |
| 46 | Ana sayfa sekme başlığında marka yok; blogda iki kez | SEO/sekme | ✅ DÜZELTİLDİ |
| 47 | Push bildirimine tıklayan ana sayfaya düşüyor | Push | ✅ DÜZELTİLDİ |
| 48 | Web push uçtan uca ÖLÜ: `sendPush` hiç çağrılmıyor | Push | ⏳ KARAR BEKLİYOR |
| 49 | Dil değiştirince arama konumu kayboluyor | Gezinme | ✅ DÜZELTİLDİ |
| 50 | Modal açılınca odak içeri taşınmıyor (yanlış diyalog seçiliyor) | Ekran okuyucu | ✅ DÜZELTİLDİ |
| 101 | Haritada OpenStreetMap atfı hiç görünmüyordu | Arama + partner konum seçici | ✅ DÜZELTİLDİ (diğer agent) |
| 102 | Altlık otomasyon tarayıcısında hiç boyanmıyor | Arama haritası | ✅ SORUN YOK — boyama zamanlaması sanrısı |
| 103 | Kamera çalışmazsa esnaf valizi HİÇ teslim alamıyordu | Esnaf paneli | ✅ DÜZELTİLDİ (diğer agent) |
| 104 | Mühür stoğu boşken ekran "sistem mühürleri atadı" diyordu | Check-in | ✅ DÜZELTİLDİ (diğer agent) |
| 105 | Check-in kapısı `open247` ve dükkan saat dilimini yok sayıyordu | Check-in (sunucu) | ✅ DÜZELTİLDİ (diğer agent) |
| 106 | Harita pinleri üst üste biniyor, okunmuyor | Harita | ✅ DÜZELTİLDİ (diğer agent) |
| 107 | Misafirin gördüğü kod 8 hane, esnafın alanı tam kimlik istiyordu | Check-in | ✅ DÜZELTİLDİ (diğer agent) |
| 108 | Rezervasyondaki "Yol Tarifi" koordinat yerine adres METNİ gönderiyordu | Rezervasyon detayı | ✅ DÜZELTİLDİ (diğer agent) |

---

### 4. Bildirim açma düğmesi sonsuza kadar takılı kalıyordu

`WebPushOptIn` şunu yapıyordu: `await navigator.serviceWorker.ready`.

O söz **etkin bir kayıt yoksa hiç çözülmez**. 2026-08-23'te eski service worker
kaldırılmıştı (`PWARegister` her açılışta hepsini siliyordu), yani uygulamada
hiçbir kayıt yoktu. Sonuç zinciri:

1. Kullanıcı "Bildirimleri aç"a basar → `setBusy(true)`
2. `ready` hiç çözülmez → `finally` hiç çalışmaz
3. Düğme **sayfa yenilenene kadar** kilitli döner, tek bir hata mesajı çıkmaz

Düzeltme: worker artık kullanıcı bildirimi açtığı ANDA kaydediliyor
(`public/push-sw.js`), ve `withTimeout` ile 10 sn üst sınır kondu — üst sınır
olmadan "başarısız" hâli hiç oluşmuyordu.

Yeni worker'da **`fetch` dinleyicisi bilerek YOK**: eski worker'ın kaldırılma
sebebi yetkili API yanıtlarını önbelleğe almasıydı. `fetch` olayına abone
olmayan bir worker tek bir isteği bile göremez; o hata sınıfı yapısal olarak
imkânsız hale geldi.

### 5. Temizlik kodu, yeni push worker'ını da silecekti

`PWARegister` **bütün** kayıtları siliyordu. Push worker'ı eklenince bu sessiz
bir hataya dönüşecekti: kullanıcı bildirimleri açar, bir sonraki sayfa
yüklemesinde temizlik onun kaydını siler, abonelik ölür, kimse fark etmez —
bildirimler yalnızca "gelmez". Artık sadece eski `/sw.js` kaldırılıyor.

### 6. İki manifest, biri ölü

- `public/manifest.json` → HTML'in gösterdiği, zengin olan (scope, shortcuts,
  maskable ikonlar, `id`)
- `src/app/manifest.ts` → `/manifest.webmanifest` üretiyordu; **hiçbir yer
  ona bağlanmıyordu** ve üstelik `src/proxy.ts` dışlama listesinde olmadığı için
  canlıda **307 redirect** dönüyordu

Yani biri düzenlense uygulamada hiçbir şey değişmezdi. Ölü olan silindi —
**bu silmeyi ben yapmadım**, aynı ağaçta çalışan diğer agent `3929ad5`'te
kaldırmış. Bulgu burada duruyor çünkü sebebi (iki kaynak, biri sessizce ölü)
tekrar oluşabilir.

### 7. Manifest olmayan ekran görüntülerini ilan ediyordu

`/screenshots/search-mobile.png` ve `/screenshots/home-desktop.png` → canlıda
**307**, `public/screenshots/` dizini hiç yok. Referanslar kaldırıldı.
**Yapılacak:** gerçek ekran görüntüleri üretilip geri eklenebilir (Android'in
zengin kurulum ekranı için); `.gitignore` yalnızca kök `*.png`'yi engelliyor,
`public/screenshots/` serbest.

### 8. İngilizcede ana sayfa arama kutusu karttan taşıyor — DÜZELTİLDİ

**Kapandı (`86887b3`, aynı ağaçtaki diğer agent).** Düğmeye
`whitespace-nowrap shrink-0` eklendi ve etiketler kısaltıldı ("Find Storage
Point" → "Find storage"; Almanca "Finden Sie den Speicherpunkt" →
"Aufbewahrung finden"). Yeniden ölçüldü (`/en`, 2560 px): kart sağ kenarı 1613,
düğme sağ kenarı **1601** — yani 12 px İÇERİDE, düğme yüksekliği 44 px (tek
satır; önce üç satıra sarıyordu). `document.body.scrollWidth` 2554 ≤ 2560,
yatay taşma yok.

Bulgunun ilk hâli aşağıda duruyor, çünkü sebebi tekrar oluşabilir: etiket
uzunluğu dile göre değişiyor ve Türkçe en kısa olanı — hata Türkçe'de hiç
görünmüyor.

#### İlk ölçüm

Ölçüm: kart `x=941→1613`, "Find Storage Point" düğmesi `1503→1650`. **37 px
dışarı**. Satır `flex-wrap: nowrap`; İngilizce tarih metni Türkçeden geniş
olduğu için sığmıyor, buton üç satıra bölünüyor.

Dosya `src/components/guest/HomeSearchWidget.tsx` — **şu an başka bir agent
üzerinde çalışıyor**, o yüzden elleşilmedi. Düzeltmesi: satıra `flex-wrap`
vermek ya da tarih alanlarına `min-w-0` koyup butonu daraltmak.

### 9. Dokunma hedefleri WCAG eşiğinin altındaydı

Canlıda ölçüldü (2026-08-31): başlık menüsündeki bağlantılar **47×12** ve
**33×12 px**, footer bağlantıları **17 px** yüksekliğinde. WCAG 2.2 kriteri
2.5.8 asgari **24×24 px** ister; ikisi de altındaydı.

Küçük hedef masaüstünde "ıskaladım" demektir, telefonda "yanlış sayfaya
gittim". Footer özellikle önemli çünkü mobilde de görünüyor ve bağlantılar
alt alta sıralı.

Düzeltme görünümü DEĞİŞTİRMİYOR: `py-2 -my-2` (footer'da `py-1.5 -my-1.5`)
ile tıklanabilir alan büyütüldü, yerleşim aynı kaldı. Liste aralığı
(`gap-4` = 16 px) komşu hedeflerin çakışmasına izin vermeyecek kadar geniş.

### 10. Mobil başlık taşıyor — Fransızca ve Almancada sayfa yana kayıyor

Gerçek mobil viewport'ta ölçüldü (Playwright, iPhone 13 / 390 px):

| Dil | Yatay kaydırma | Sebep |
|---|---|---|
| TR | 0 px | — |
| JA | 0 px | — |
| DE | **13 px** | "anmelden" düğmesi sağ kenarı 6 px aşıyor |
| FR | **33 px** | "Se connecter" düğmesi sağ kenarı 33 px aşıyor |

Başlık `justify-between`; sağdaki kontroller (`LocaleSwitcher`, `UserNav`)
`shrink-0`, logo ise küçülemiyordu. Toplam 390 px'i aşınca sayfa yana
kayıyor — telefonda bu, kaydırırken içeriğin sağa sola oynaması demek.
Türkçede görünmüyordu çünkü "GİRİŞ YAP" kısa; yani hata **yalnızca ana
dilde test edilirse görünmez**.

Düzeltme iki parçalı: logoya `min-w-0` + marka adına `truncate` (esneyebilen
tek öge o), ve Beta rozetine `hidden sm:inline-block` (390 px'de rozet, marka
adından önce feda edilecek öge). Sabit boşluk ayarı yerine esneme seçildi;
yarın eklenecek daha uzun bir etiket aynı hatayı geri getirmesin.

### 11. Mobil aramada hiç sonuç görünmüyordu

Alt panel `snapPoints={[22, 60, 92]}` ile **%22'de** açılıyordu. Ölçüldü
(iPhone 13, 664 px yükseklik): %22 = **146 px**, ve o 146 pikselin tamamı
tutamaç + sekmeler + "YAKINDAKİ (11)" başlığıyla doluyor. **Tek bir dükkan
kartı bile görünmüyor.**

Kullanıcının gördüğü: harita, üstünde üst üste binmiş "Yakında" pinleri, ve
altta içi boş görünen bir panel. Ürünün ana ekranında ilk anlamlı içerik
katlanın altında; üstelik panelin sürüklenebildiğini söyleyen bir şey de yok.

İlk durak %42'ye (~279 px) çekildi: ilk kart tam görünüyor, harita hâlâ
ekranın yarısından fazlası. Diğer duraklar (70, 92) aynen duruyor.

### 12. Çerez paneli mobilde ana eylemi örtüyor — AÇIK

Ekran görüntüsüyle doğrulandı, iki sayfada birden:

- **Ana sayfa**: hero'daki arama kutusunun ALIŞ alanı, valiz sayısı ve
  "Emanet Noktası Bul" düğmesi panelin altında kalıyor.
- **Arama sayfası**: alt panelin TAMAMI örtülüyor; kullanıcı sonuç listesini,
  tarih alanlarını ve filtreleri hiç göremiyor.

Rıza panelinin görünür olması gerekiyor, ama ana eylemi kapatması dönüşümü
düşürür. Öneri: mobilde kompakt tek satır + iki düğme (yaklaşık 96 px),
metnin detayı "Detaylar" bağlantısının arkasına.

### 106. Harita pinleri üst üste biniyor — DÜZELTİLDİ

Mobilde Fatih/Üsküdar çevresinde altı "Yakında" etiketi birbirinin üstüne
biniyor ve hiçbiri okunmuyordu. Sorunu büyüten şey talep testinin 50 noktadan
**482'ye** çıkması: nokta eklemek haritayı okunmaz yapıyorsa, ölçmek için
eklenen noktalar ölçmek istediğimiz davranışı engelliyor demektir.

**Çözüm ekran mesafesiyle kümeleme** (`clusterByScreenDistance`), MapLibre'nin
GeoJSON küme katmanı DEĞİL. Küme katmanı pin'lerin fiyat/"Yakında" etiketini ve
DOM tıklama/klavye davranışını kaybettirirdi; burada görünüm aynı kalıyor,
yalnızca üst üste binenler tek bir sayıya dönüşüyor.

Eşik **44 px** — pin yüksekliğiyle ve WCAG dokunma hedefiyle aynı: bu mesafenin
altındaki iki pin ne okunabiliyor ne de ayrı ayrı dokunulabiliyor.

Neden coğrafi mesafe değil: çakışma bir **görüntü** olayı. Aynı iki nokta z=10'da
üst üste binerken z=16'da rahatça ayrı durur. Bu yüzden kümeler her `moveend`'de
yeniden hesaplanıyor. (`fitBounds` de bir `moveend` üretir; çizim ile sığdırma
ayrı efektlerde, yoksa sonsuz döngü olurdu.)

Kümeye dokunmak **seçmez, yakınlaştırır**: hangi noktanın kastedildiği
belirsizken birini açmak kullanıcı adına karar vermek olurdu.

Ölçüldü (İstanbul, 16 nokta): tek "2" rozeti çizildi; tıklayınca yakınlaştı ve
kümeler `2 + 5 + 9 = 16` olarak yeniden hesaplandı — hiçbir nokta kaybolmadı,
hiçbiri iki kez çizilmedi (test bunu da doğruluyor).

### 14–15. Mobil checkout: görünenle özet çelişiyor — SEBEBİ ÖLÇÜLDÜ

**2026-08-31 güncellemesi — kaynak kesinleşti.** Örtülme testi yapıldı
(satırın merkez noktasında `elementFromPoint` ile üstteki öge kim):

| Satır | Üst konum | İlk açılışta örtülü mü |
|---|---|---|
| Küçük Valiz (S) — sayı **0** | 339 | hayır |
| Orta/Büyük (M/L) — sayı **1** | 437 | **evet** |
| Ekstra Büyük (XL) — sayı 0 | 543 | **evet** |

Yapışkan özet çubuğu y=455'te başlıyor. Yani kullanıcı **0 yazan satırı
görüyor, 1 sayılan satırı görmüyor** — çelişki tam olarak buradan.

Sayfa kaydırılabiliyor (669 px kaydırma payı var), yani satırlar
erişilemez değil; **keşfedilemez**. Kullanıcıya "aşağıda bir şey var" diyen
bir işaret yok.

Denendi ve İŞE YARAMADI: mobil alt menüyü gizlemek örtülmeyi değiştirmiyor
(çubuk zaten y=455'te başlıyor, menü onun içinde). Yani #15'in çözümü
sanıldığı gibi "alt menüyü gizle" değil; **özet çubuğunun kendisi** ya da
üstündeki başlık/adım göstergesi daralmalı.

Varsayılanı S'e çevirmek (görünen satırla özeti eşitlerdi) fiyat kararıdır —
S daha ucuz — ve bu denetimin yetkisinde değil.

Akış gerçekten denendi: arama → dükkan → "REZERVASYON YAP" → `/tr/checkout/<id>`.
Sayfa ölçümde temiz (yatay kaydırma yok, kırpılma yok, **etiketsiz form
girdisi yok**). Sorun düzende:

- Ekranda görünen tek valiz satırı **"Küçük Valiz (S) … 0"**, ama hemen
  altındaki özet **"1 Valiz · 1 gün · ₺50,00"** diyor. Sayılan valiz M/L
  satırında ve o satır katlanın altında. Kullanıcı ilk bakışta "0 seçtim ama
  1 valiz mi ödüyorum?" diye okuyor.
- Sabit alan **209 px / 664 px = ekranın %31'i** (özet + DEVAM çubuğu, içinde
  mobil alt menü). Geriye kalan 455 px'e başlık + adım göstergesi + dükkan adı
  + valiz satırları sığmıyor: **üç valiz tipinden yalnızca biri** görünüyor.

Öneri (uygulamadım, karar senin): checkout adımlarında mobil alt menüyü
gizlemek. Ödeme akışında kullanıcıyı sayfadan çıkaran bir menü zaten
istenmiyor ve 77 px geri kazandırır — üç valiz satırının ikisi görünür hale
gelir. `MobileNav` içinde zaten sayfaya göre davranış var (`isDetailPage`).

### Dükkan detay sayfası — ölçüldü, büyük ölçüde temiz

Mobil ve masaüstünde yatay kaydırma yok, taşma yok, kırpılma yok. Tek kusur:
sayfanın en altında footer telif satırının ~13 px'i yapışkan fiyat çubuğunun
altında kalıyor (düşük öncelik).

### 16. Almancadaki 13 px kayma: `BottomSheet` başlığı

10 numaralı düzeltme Fransızcayı çözdü (33 → 0) ama Almancada 13 px kaldı.
İz sürüldü: kaydırmayı yaratan öge başlık değil, **alt panelin başlık satırı**.

```
html            scrollWidth 403  (viewport 390)
 └ body                     403   overflow-x: hidden
   └ div.fixed.inset-0.z-40      ← BottomSheet
     └ div.flex.items-center.justify-between.px-5  → 14 px taşıyor
```

Başlık `<h2>` `min-w-0`/`truncate` taşımıyordu; `id-eyebrow` büyük harf ve
geniş harf aralığı uyguladığı için aynı metin Almancada Türkçedekinden
belirgin geniş çıkıyor. Panel `fixed` olduğu için taşma belgeye yansıyor ve
sayfa yana kayıyor. Başlığa `min-w-0 truncate`, kapatma düğmesine `shrink-0`.

### 17–18. Renk kontrastı — ÖLÇÜLDÜ, KARAR SENİN

Üç sayfada ölçüldü (mobil + masaüstü). Sistemik iki sorun:

| Kombinasyon | Oran | Gereken | Nerede |
|---|---|---|---|
| Beyaz üstü `orange-600` (#e9590c) | **3.56** | 4.5 | Her birincil buton: "Emanet Noktası Bul", "GİRİŞ YAP", "REZERVASYON YAP", fiyat baloncukları |
| `gray-400` (#a8a29e) beyaz üstü | **2.52** | 4.5 | İkincil metin, yardım metinleri, "10 m uzakta", form etiketleri — **406 kullanım** |
| Beyaz üstü `orange-600` metin | 3.56 | 4.5 | "Partner Ol", "Süreci adım adım gör", aktif sekme |
| `gray-500` gri-50 üstü | 4.40 | 4.5 | "Tüm Noktalar (100)" sekmesi — kıl payı |

**Neden önemli:** bu ürün sokakta, güneş altında, telefonla kullanılıyor.
2.52:1 gri metin kapalı bir odada bile zor okunur; dışarıda okunmaz. Ayrıca
Avrupa Erişilebilirlik Yasası (Haziran 2025) AA'yı zorunlu kılıyor ve hedef
kitle Avrupalı turist.

**Neden kendim değiştirmedim:** ikisi de MARKA kararı. Düzeltmeleri tek satır:

```css
/* src/app/[locale]/globals.css */
--color-gray-400: #78716c;   /* 2.52 -> 4.80; 406 kullanımı birden düzeltir */
```

Turuncu için `orange-700` (#c2410c) beyazla **5.18** veriyor; ama bu markanın
ana tonunu koyulaştırmak demek. Alternatif: butonlarda yazıyı büyütüp
kalınlaştırmak (18.66px + bold ⇒ eşik 3:1'e düşer, mevcut 3.56 geçer).

Hangisini istersin? Söyle, uygularım ve öncesi/sonrası ekran görüntüsüyle
gösteririm.

### 19. PWA her açılışta Türkçe açılıyor — AÇIK

Ölçüldü:

```
Accept-Language: tr        ->  /tr
Accept-Language: en-US,en  ->  /tr
Accept-Language: de-DE,de  ->  /tr
```

`src/i18n/routing.ts` içinde `localeDetection: false` ve manifest
`start_url: "/"`. Sonuç: İngilizce gezip uygulamayı kuran bir turist, **her
açılışta Türkçe** karşılanıyor ve dili her seferinde elle değiştiriyor.
Hedef kitlenin yabancı turist olduğu bir üründe bu ciddi bir sürtünme.

Dokunmadım çünkü `localeDetection`'ı açmak SEO'yu ve tüm kullanıcıların
yönlenmesini etkiler — paylaşılan altyapı. Daha dar bir çözüm: kullanıcı dili
DEĞİŞTİRDİĞİNDE bir tercih çerezi yazmak ve yalnızca `/` kökünde onu okumak.
Tarayıcı diline göre otomatik yönlendirme olmadığı için SEO davranışı aynı
kalır.

### 21. GÜVENLİK — `callbackUrl` açık yönlendirmesi

`sanitizeAuthCallbackUrl` yalnızca `//` ile başlayan değerleri eliyordu. Ama
WHATWG URL ayrıştırıcısı http(s) gibi "özel" şemalarda **ters bölüyü eğik
çizgiyle eş sayar** ve tab/satır başı karakterlerini URL'den atar. Ölçüldü:

| Girdi | Eski sanitize | Tarayıcının çözdüğü |
|---|---|---|
| `/\evil.com` | `/\evil.com` (geçiyor) | **https://evil.com/** |
| `/\tevil` | `/\tevil` (geçiyor) | **https://tevil/** |
| `//evil.com` | `/` | bagajpark.com |

Saldırı: kurbana `.../login?callbackUrl=/\evil.com` bağlantısı gönderilir;
kurban **gerçek BagajPark adresinde** giriş yapar ve sonrasında saldırganın
sitesine düşer. Adres çubuğunda doğru site göründüğü için kimlik avı ikna
edici olur.

Düzeltme iki katmanlı: (1) ters bölü ve kontrol karakterleri önce
normalleştiriliyor, (2) sonuç `URL` ile ÇÖZÜLÜP origin'in değişmediği
doğrulanıyor. İkincisi asıl koruma — kalıp ezberlemek her zaman bir sonraki
kaçış yolunu kaçırır, tarayıcının kendi kuralına sormak kaçırmaz.

7 testlik `src/__tests__/auth-callback-url.test.ts` eklendi.

### 22. "Hareketi azalt" tercihi yok sayılıyordu

`globals.css` içinde bir `@media (prefers-reduced-motion: reduce)` bloğu VAR,
ama o blok yalnızca **CSS** animasyon ve geçişlerini durduruyor. Uygulamadaki
animasyonların çoğu **framer-motion** ile, yani JavaScript'in satır içi
`transform` yazmasıyla çalışıyor — CSS kuralı onlara hiç değmiyor. 18 bileşen
framer-motion kullanıyor.

Sonuç: telefonunda "Hareketi Azalt"ı açmış bir kullanıcı, bütün kayma/ölçek
animasyonlarını aynen görüyordu. Bu tercih meselesi değil; vestibüler
rahatsızlığı olanlarda hareket baş dönmesi ve mide bulantısı yapar.

Düzeltme tek satır: `Providers` içinde `<MotionConfig reducedMotion="user">`.
Tercihi olmayan kullanıcı için hiçbir şey değişmiyor.

### 23. %200 metin büyütmede yatay kaydırma — KISMEN

WCAG 2.2 kriteri 1.4.4 metnin %200'e büyütülebilmesini ve içeriğin yatay
kaydırma OLMADAN yeniden akmasını ister. Az gören kullanıcının günlük ayarı.

Ölçüldü (iPhone 13, kök font 32px): ana sayfa **93 px** yana kayıyor, başlık
iki yandan birden kırpılıyor. Kaynak izlendi:

```
header.sticky   clientWidth 388   scrollWidth 482
 └ div.flex (esneyebilir, 176 px'e küçüldü)
   └ div.shrink-0  w=184  right=483   ← ESNEMEYEN çocuk, ebeveyni aşıyor
     └ a.btn-ui "Giriş yap"
```

Giriş düğmesinin sarmalayıcısı `shrink-0` taşıyordu; logo o noktada zaten
"B…"ye inmiş, küçülecek başka öge kalmamıştı. `shrink-0` kaldırıldı ve
düğmeye `min-w-0 truncate` verildi.

İlk denemede **93 → 48 px**; yani yarıya indi ama bitmedi. Kalan 48 px'in
sebebi ayrı ölçüldü: düğme `inline-flex`, yani genişliğini **içeriğinden**
alıyor. Böyle bir öge için `min-width: 0` ve `flex-shrink` yetmez — üst sınır
gerekir. `max-w-full` eklenince düğme 184 → 103 px'e indi.

**Ölçülen son durum: 93 px → 0 px.**

Ders: bir flex öğesinin küçülmemesinin iki ayrı sebebi olabilir (esneme
kilitli, ya da genişlik içerikten geliyor) ve ikisi ayrı ayrı kapatılmalı.
İlk düzeltmeden sonra "tamam" deyip geçilseydi, sorun yarı yarıya duruyordu.

### 24–25. %200 büyütme, diğer sayfalar

Ana sayfa kapandıktan sonra aynı test beş sayfaya daha uygulandı:

| Sayfa | %200'de yatay kaydırma |
|---|---|
| `/tr/search` | 0 ✅ |
| `/tr/faq` | 0 ✅ |
| `/tr/shop/<id>` | 17 px → **0** ✅ (#26) |
| `/tr/insurance` | 76 px → **0** ✅ (#25) |
| `/tr/checkout/<id>` | **200 px** → 0 ✅ |

**Checkout (en kötüsü, düzeltildi):** kaynak `BagSelector` satırıydı.
`justify-between` ile iki grup (etiket + adımlayıcı) yan yana duruyor; %200'de
ikisi de büyüyor ama satır sarmalanamadığı için taşıyor. `flex-wrap` açıldı,
etiket `min-w-0 flex-1` ile küçülebilir yapıldı, adımlayıcı `shrink-0` ile
korundu — çünkü +/- düğmeleri dokunma hedefi, daralırsa isabet edilemez.
Ölçüldü: **200 px → 0**.

**Sigorta (76 px, düzeltildi):** özyinelemeli arama (her seviyede çocuğu
gizleyip kaydırmanın düştüğü dalı takip etmek) suçluyu `h1.text-5xl`'e
indirdi. %200'de bu başlık 96 px'lik fonta çıkıyor ve "Koruması" gibi tek bir
kelime 390 px'e sığmıyor. Zaten commit'lenmiş olan `body { overflow-wrap:
break-word }` kuralı bunu çözüyor — ölçüldü: **76 px → 0**.

Bu, kuralın gerekçe yorumunu düzeltmemi gerektirdi: geçen tur "işe yaramadı"
yazmıştım, çünkü ana sayfada denemiştim ve orada sebep başkaydı. Aynı belirti
(yatay kaydırma) farklı sebeplerden geliyor; her sayfayı ayrı ölçmek gerek.

**Dükkan (17 px, dokunulmadı):** suçlu, hero'nun sol üstündeki geri rozeti —
`div.absolute.top-4.left-4.right-4` içindeki `a.inline-flex` ("BagajPark").
%200'de dolgu + boşluk + metin 390 px'i aşıyor. Doğrulandı: rozete
`min-w-0 max-w-full` + kırpma verilince **17 px → 0**.

Dosya `src/components/guest/ShopDetailClient.tsx` idi ve o sırada başka bir
agent üzerinde çalışıyordu; bir sonraki turda dosya serbest kalınca uygulandı.
Aynı yapıdaki masaüstü varyantına da eklendi — `inline-flex` genişliğini
içeriğinden alır, `max-w` olmadan küçülemez.

### 27. %200 + uzun dil: iki küçük kalıntı — SEBEBİ BULUNAMADI

Bütün düzeltmeler uygulanmış hâlde DE/FR/JA'da tekrar ölçüldü:

| | ana sayfa | arama | sigorta |
|---|---|---|---|
| DE | 0 | 0 | **28 px** |
| FR | **7 px** | 0 | 0 |
| JA | 0 | 0 | 0 |

Özyinelemeli arama DE sigortada `li.flex.items-center.gap-2` ("Lückenlose
Verwahrungs…") ve içindeki `svg`'ye işaret etti. Ama **bu bir nedensellik
kanıtı değil**: yöntem "gizlenince kaydırma düşen" ögeyi buluyor ve büyük
herhangi bir ögeyi gizlemek de kaydırmayı düşürür.

Nitekim ona göre yazdığım iki düzeltme adayı ölçümde durumu **kötüleştirdi**:

```
düzeltmesiz                                 28 px
+ ikon shrink-0                             44 px
+ ikon shrink-0 + li min-w-0 + items-start  44 px
```

**Sonraki turda çözüldü — yöntem değiştirilerek.** Gizleme testi yerine
**nedensellik testi**: her ögeye tek tek `overflow-x: hidden` verip sayfa
kaydırmasının bitip bitmediğine bakmak. Bu, "kaçıran kapsayıcıyı" doğrudan
bulur; gizleme ise yalnızca "büyük olan"ı bulur.

Sonuç, ikisinde de aynı sınıf çıktı:

| Sayfa | Kaçıran kapsayıcı | İçerik |
|---|---|---|
| DE sigorta | `li.flex.items-center.gap-2` | "Lückenlose Verwahrungs…" |
| FR ana sayfa | `h3.text-lg.font-black` | "Récompenses BagajPark" |

**Asıl içgörü:** `overflow-wrap: break-word` bir kelimeyi satır taşarken böler
ama ögenin **min-content genişliğini küçültmez**. Flex/grid öğeleri varsayılan
`min-width: auto` taşıdığı için min-content'in altına inemez — yani uzun
kelimeli metin flex satırında hâlâ taşar. `anywhere` ise oluşturduğu bölme
fırsatlarını min-content hesabına **da** katar.

Ölçüldü (%200 metin):

```
kural          /de/insurance  /fr   /tr  /tr/search  /de  /ja
break-word         28 px      7 px   0       0        0    0
anywhere            0          0     0       0        0    0
```

Normal yazı boyutunda yan etki ölçüldü: sayfa yüksekliği 7419 → 7399 px,
başlık aynı 2 satır, yatay kaydırma ikisinde de 0. Görünür değişiklik yok.

### 28–31. Başlık ve işaret (landmark) yapısı

Altı sayfa mobil viewport'ta tarandı:

| Sayfa | `h1` | Seviye atlaması | `main` | Etiketsiz `nav` |
|---|---|---|---|---|
| `/tr` | 1 | h2→h4 | 1 | 0 |
| `/tr/search` | **0** | h2→h4 | 1 | 1 |
| `/tr/shop/<id>` | **2** | h2→h4 | **3** | 0 |
| `/tr/checkout/<id>` | 1 | — | **2** | 1 |
| `/tr/insurance` | 1 | h2→h4 | 1 | 0 |
| `/tr/faq` | 1 | h2→h4 | **2** | 0 |

**Düzeltilen 28 — arama sayfasında `h1` yok:** var olan tek `h1`,
`isDesktop` dalındaki kenar panelinin içindeydi ve mobilde hiç render
edilmiyordu. Ekran okuyucu kullanıcısı ürünün ana ekranında sayfanın ne
olduğunu söyleyen bir başlık bulamıyordu. Görsel olarak gizli (`sr-only`) tek
bir `h1` eklendi; metni SEO başlığıyla aynı anahtardan geliyor. Masaüstündeki
`h1` `<p>`ye çevrildi — içeriği zaten sayfa başlığı değil, arama alanının
etiketiydi.

**Düzeltilen 29 — footer `h2→h4`:** footer sütun başlıkları `h4`tü; sayfanın
son `h2`sinden sonra iki seviye atlıyordu. Ekran okuyucuda başlıktan başlığa
gezinen kullanıcı için bu "arada bir başlık kaçırdım mı?" demek. Dördü de
`h2` yapıldı (görsel sınıflar aynı kaldı, görünüm değişmedi). Dört sayfadaki
atlamayı birden kapatıyor.

**Düzeltilen 30 — iç içe `main`:** kök `layout.tsx` zaten
`<main id="main-content">` render ediyor, ama **25 dosya** (18 sayfa + 7
bileşen) kendi `<main>`'ini de açıyordu. Yani her sayfada `main` içinde `main`
vardı — geçersiz HTML ve işaret gezinmesini ("ana içeriğe git") belirsiz
kılıyor. Hepsi `<div>`e çevrildi; `main` ve `div` ikisi de blok, görünüm
değişmedi. Artık kaynakta tek bir `<main>` var: layout'unki.

**DÜZELTME: "dükkan sayfasında 2 `h1`" bulgum YANLIŞTI.** Ataya bakan ölçümle
kontrol edildi:

```
h1 #1  "Furkan'ın Diğer Mekan"  checkVisibility: true   yükseklik 55
h1 #2  "Furkan'ın Diğer Mekan"  checkVisibility: false  yükseklik  0
```

İkinci `h1`, `hidden md:block` kapsayıcısının içinde; `display:none` içerik
erişilebilirlik ağacına HİÇ girmez, yani ekran okuyucu tek `h1` görüyor.

Ölçüm hatam şuydu: görünürlüğü ögenin **kendi** `display`ine bakarak
süzüyordum. `display:none` bir ebeveynin çocuğu, kendi `display`ini yine
`block` olarak raporlar. Doğrusu `el.checkVisibility({checkVisibilityCSS:
true})` — ataları da hesaba katıyor. Bundan sonraki taramalarda bu kullanılmalı.

### 32. Takvim, ekran okuyucuya her dilde İngilizce konuşuyordu

İşaret taraması sırasında Türkçe sayfada `aria-label="Navigation bar"` diye
**iki** işaret çıktı — ne kodda ne dil dosyalarında böyle bir metin var.
İzlendi: `nav.rdp-nav`, yani **react-day-picker**'ın ay gezinme çubuğu.

Kütüphane kendi ARIA etiketlerini İngilizce üretiyor ve bunlar `locale`
prop'undan **etkilenmiyor**. Altı dilin hepsinde ekran okuyucu şunu duyuyordu:

```
nav      → "Navigation bar"
düğmeler → "Go to the Previous Month" / "Go to the Next Month"
```

Yani görme engelli bir Türk kullanıcı, tarih seçicinin kontrollerini
İngilizce duyuyordu — üstelik iki takvim (bırakış + alış) olduğu için aynı
anlamsız etiket iki kez.

Düzeltme `labels` prop'u ile. **Yeni çeviri anahtarı eklenmedi, bilerek:** ay
adını kullanıcının kendi diliyle `Intl` üretiyor ("Eylül 2026"), nav etiketi
zaten var olan `Common.selectDate`. Böylece Farsça ve Japonca dahil altı dilde
birden doğru — benim çeviremeyeceğim diller de dahil. Düğme artık hedef ayı
söylüyor, ki bu "önceki aya git"ten daha bilgilendirici.

### 33. Aynı hata haritada da vardı — üçüncü taraf bileşenler kendi dilinde konuşuyor

Takvim bulgusundan sonra bütün sayfa İngilizce erişilebilirlik metni için
tarandı. MapLibre de aynısını yapıyordu — ve bu, ürünün **ana ekranı**:

```
canvas → "Map"
düğme  → "Zoom in" / "Zoom out"
özet   → "Toggle attribution"
```

MapLibre'nin `locale` seçeneği ile dört etiket çevrildi
(`Common.mapZoomIn` vb., altı dile eklendi).

**Bu artık bir desen, tek olay değil.** Üçüncü taraf bir bileşen eklenirken
"kendi metinlerini de basıyor mu?" diye bakmak gerekiyor. Gözle bakınca
görünmüyorlar, çünkü yalnızca ekran okuyucuya gidiyorlar. Sonraki denetimlerde
şu tarama tekrarlanmalı:

```js
// Görünür ögelerdeki İngilizce aria-label / title
document.querySelectorAll("[aria-label],[title]")
  → /^(zoom|reset|go to|navigation|close|open|previous|next|toggle)\b/i
```

### 34. PWA ikonu kurulumda kırpılacaktı

Manifest her iki ikonu da `purpose: "any maskable"` ilan ediyordu. Maskable
ikonlarda Android, ikonu bir şekle (daire/squircle) kırpar ve yalnızca
**merkezdeki %80** garanti altındadır. Ölçüldü:

```
icon-512x512.png   marka sınır kutusu (0, 24, 486, 510)
                   güvenli kare       (51, 51, 460, 460)
                   aşma (sol,üst,sağ,alt) = 51, 27, 26, 50 px
                   marka, ikonun %95'ini kaplıyor
```

Yani bavulun **sapı ve tekerlekleri** kurulu uygulamanın simgesinde
kırpılacaktı — kullanıcının ana ekranında gördüğü ilk şey.

Doğru kurulum ikisini ayırmak: orijinaller `purpose: "any"` (tarayıcı sekmesi,
masaüstü — tam dolgulu iyi), ve yeni üretilen kenar paylı varyantlar
`purpose: "maskable"`. Varyantlar orijinalin %80'e küçültülüp aynı arka plan
renginde ortalanmasıyla üretildi; tasarım değişmedi, yalnızca pay eklendi.
Doğrulandı: yeni ikonlarda güvenli bölge aşımı **0**.

### 35. İletişim formu: etiketler görünüyor ama bağlı değil

Form gerçekten dolduruldu ve ölçüldü. Üç alanın (`name`, `email`, `message`)
etiketi **görsel olarak var** ama girdiye **bağlı değil** — ne `htmlFor` ne de
sarmalama. Ekran okuyucu bunları adsız okuyor: "düzenlenebilir metin, zorunlu"
ve başka hiçbir şey. Üçü de `required`, yani kullanıcı hangi alanı
doldurmadığını da anlayamıyor.

Ayrıca hiçbirinde `autocomplete` yoktu: mobilde tarayıcının ad/e-posta
önermesi buna bağlı (ve WCAG 1.3.5 bunu istiyor). Hata kutusunda `role="alert"`
yoktu, yani gönderim başarısız olduğunda ekran okuyucuya hiçbir şey
duyurulmuyordu.

Üçü de düzeltildi.

### 36. Rezervasyon sorgulama — hata UX'i iyi, otomatik doldurma yok

Akış denendi: geçersiz kodla sorgulandı. **Hata yönetimi sağlıklı çıktı** —
`role="alert"` var ve mesaj net: "Rezervasyon bulunamadı veya bilgiler
eşleşmiyor." Ekran okuyucuya duyuruluyor.

Eksik olan `autocomplete`/`inputmode`'du. Bu form misafirin rezervasyonunu
bulmak için doldurduğu iki alandan biri; öneri olmadan kullanıcı adresini
küçük ekranda elle yazıyor ve **yanlış yazarsa aldığı cevap "Rezervasyon
bulunamadı" oluyor** — yani sistem hatasını kendi yazım hatasından ayırt
edemiyor. Eklendi.

`PrelaunchDemandPanel.tsx` ve `PrelaunchNotifyButton.tsx` dosyalarında da aynı
eksik var; ikisi de başka agent'in özelliği olduğu için dokunulmadı. Düzeltmesi
tek satır: e-posta girdisine `autoComplete="email" inputMode="email"`.

### Mandal testinin kırılgan yanı (yol boyunca öğrenildi)

`input-labels` mandalı, girdiden **400 karakter geriye** bakıp sarmalayan bir
`<label>` arıyor. Bu alana uzun bir açıklama yorumu eklediğimde etiket o
pencerenin dışına itildi ve test, **doğru etiketlenmiş** bir girdiyi etiketsiz
saydı. Çözüm: açıklama yorumları `<label>` ile `<input>` ARASINA değil,
etiketin üstüne yazılmalı. Bu, bu repoda yorum yazarken bilinmesi gereken bir
kısıt.

### Yaygın sanılan ama gerçek olmayan bulgu

`<label>` ögelerini `htmlFor` için grep'lediğimde 12 dosyada ~45 "eksik" çıktı.
Canlıda ölçünce **misafir yüzeyindeki tek gerçek sorun iletişim formuydu**;
geri kalan etiketlerin çoğu girdisini SARMALIYOR, ki bu da geçerli bir
ilişkilendirme. Kalanlar `aria-hidden` test girdileri.

Not: grep bir hipotez üretir, ölçüm karar verir. Bu denetimde grep'e göre
hareket etseydim 12 dosyada gereksiz değişiklik yapmış olacaktım.

### 31. Footer yasal bağlantı `nav`'ı etiketsizdi

Arama ve checkout sayfalarında üç-dört işaret var; etiketsiz olan, ekran
okuyucuda ayırt edilemiyordu. `Footer.legalNavLabel` anahtarı altı dile
gerçek çevirisiyle eklendi ve `aria-label` olarak bağlandı. (Bu, oturumda dil
dosyalarına dokunduğum ikinci yer — diğer agent'in o dosyalarda açık işi
olmadığı doğrulandıktan sonra yapıldı.)

### 39. Kısa etiketli diller: dokunma hedefi YATAYDA da ölçülmeli

Footer'daki kök kuralım yalnızca **dikey** pay veriyordu (`py-1.5 -my-1.5`).
Yükseklik eşiği geçiyordu ama Farsça gibi kısa etiketli dillerde **genişlik**
altta kalıyordu:

```
/fa footer  "لغو" (iptal)  20×32 px   → yükseklik tamam, genişlik değil
/fa ana sayfa "رم" (Roma)  21×30 px   → şehir çipi
```

İkisi de `px-1 -mx-1` (footer) ve `min-w-11` (çip) ile kapandı. Uzun isimlerde
hiçbir şey değişmiyor; yalnızca alt sınır kondu.

**Ders:** dokunma hedefi kuralı iki eksenlidir. Türkçe/İngilizce test ederken
etiketler yeterince uzun olduğu için yatay eksen hiç sınanmıyor — hata ancak
kısa yazan dillerde görünüyor.

### 42. Çevrimdışı: kullanıcı dinozor sayfası görüyor — KARAR BEKLİYOR

Ölçüldü (Playwright, ağ kesilerek):

```
service worker kaydı : 0
önbellek             : 0
çevrimdışı gezinme   : ERR_INTERNET_DISCONNECTED — Chrome'un dinozor sayfası
```

Uygulama `display: standalone` ile **kurulabilir** bir PWA. Yani kullanıcı onu
ana ekranına ekleyip açtığında, ağ yokken uygulama kabuğunun içinde
tarayıcının jenerik hata ekranını görüyor — marka yok, ne yapacağını söyleyen
bir metin yok, rezervasyon kodunu gösteren bir şey yok. Metroda, havalimanında
ya da roaming boşluğunda tam da bu oluyor ve ürün bir seyahat ürünü.

**Kendim yapmadım, çünkü:** çözüm bir service worker gerektiriyor ve öncekini
2026-08-23'te **bilerek** kaldırmışsınız — yetkili API yanıtlarını
önbelleğe alıyordu, yani bir kullanıcının verisi başka bir oturumda geri
servis edilebiliyordu. O kararı sessizce geri almak doğru olmaz.

**Güvenli tasarım (öneri):** yalnızca GEZİNME isteklerini ele alan, önce ağı
deneyen ve yalnızca ağ başarısız olursa tek bir statik `/offline` sayfasını
gösteren bir worker. API yanıtı, yetkili içerik, kullanıcı verisi hiç
önbelleğe alınmaz — eski hatanın sınıfı yapısal olarak imkânsız kalır.
`push-sw.js` zaten aynı disiplinle yazıldı (fetch dinleyicisi yok).

Karar senin: "yap" dersen güvenli varyantı yazar, ölçüp gösteririm.

### 43–44. E-posta şablonu — hiç denetlenmemiş bir yüzey

Rezervasyon ürününde onay/hatırlatma e-postaları da bir UX yüzeyi ve bu
denetimde hiç bakılmamıştı. `src/lib/email-template.ts` ölçüldü.

**Kontrast (beyaz yazı, renkli zemin):**

| Ton | Oran | Durum |
|---|---|---|
| marka `#ea580c` | 3.56 | ⏳ #17 ile aynı karar (marka) |
| başarı `#16a34a` | **3.30** | ✅ `#15803d` yapıldı → 5.02 |
| uyarı `#dc2626` | 4.83 | ✓ |
| bilgi `#2563eb` | 5.17 | ✓ |
| gövde `#6b7280` beyazda | 4.83 | ✓ |

Başarı tonu marka rengi **değil**, durum rengi — o yüzden karar beklemeden
düzeltildi. Bu ton hem başlıkta hem ana eylem düğmesinde kullanılıyor, yani
e-postanın en çok okunan iki yerinde.

**`lang` eksikti.** Kabuk `dir="rtl"` basıyordu ama dili hiç söylemiyordu.
Dil olmadan ekran okuyucu e-postayı yanlış telaffuz eder, Gmail/Apple Mail'in
çeviri önerisi çalışmaz, tireleme kuralları şaşar — üstelik dil zaten
`content.locale` olarak elde. Eklendi; mevcut `dir` testinin niyeti bozulmasın
diye öznitelik sırası korundu ve `lang` için ayrı bir güvence yazıldı.

### 45. Yazdırılan fiş — hiç denetlenmemiş bir çıktı

Rezervasyon detayında bir "Fişi indir" düğmesi var ve `window.print()`
çağırıyor. `globals.css` içinde bir yazdırma stili de var:

```css
@media print {
  body * { visibility: hidden; }
  body .print-area, body .print-area * { visibility: visible; }
}
```

**İyi haber:** `.print-area` gerçekten var (`bookings/[id]/page.tsx:90`), yani
boş kâğıt çıkmıyor — bu kurulumda en sık görülen hata bu ve burada yok.

**Sorun:** `.print-area` bütün sütunu sarıyor, içinde şunlar da var:

| Öge | Kâğıtta ne işi var |
|---|---|
| "← Rezervasyonlarım" bağlantısı | Tıklanamaz, anlamsız |
| `BookingDetailActions` (iptal / değiştir) | **Basılı bir "İptal et" düğmesi kafa karıştırıcı** |
| `PrintButton` ("Fişi indir") | Kendini basıyor |

Fiş, otelde/havalimanında basılıp esnafa gösterilen bir belge; üstünde işlemez
düğmeler olması onu belge olmaktan çıkarıyor.

**Düzeltmesi:** üç ögeye Tailwind'in `print:hidden` varyantı. Tek satırlık,
görünüm ekranda hiç değişmiyor.

**Uygulandı** (dosya serbest kalınca, bir sonraki turda): üç öge
`print:hidden` aldı. Ekranda hiçbir şey değişmiyor.

**Ölçülemedi:** gerçek bir fişin nasıl basıldığı — o sayfa giriş ya da geçerli
bir rezervasyon kodu gerektiriyor. Yukarıdaki tespit kaynak koddan.

### 47. Push bildirimi yanlış yere götürüyordu

Sunucu ile service worker arasında gövde uyuşmazlığı — ve ikisi de bu
denetimde benim dokunduğum kod:

```
sunucu gonderiyor : { title, body, bookingId }     (NotificationService.sendPush)
worker ariyordu   : payload.url                    (push-sw.js)
```

`url` hiç gelmediği için worker `"/"`e düşüyordu: **rezervasyonuyla ilgili bir
bildirime dokunan kullanıcı ana sayfaya gidiyor** ve aradığı şeyi kendisi
bulmak zorunda kalıyordu. Bildirimin tek işi kullanıcıyı doğru yere götürmek
olduğu için bu, özelliği anlamsız kılıyor.

Worker artık `bookingId` varsa `/bookings/<id>`e gidiyor. Yol dil öneksiz
veriliyor ve `src/proxy.ts` onu kullanıcının diline yönlendiriyor — canlıda
doğrulandı:

```
/bookings/<id>  ->  307  ->  /tr/bookings/<id>
```

Worker'ın dili bilmesi gerekmiyor, ki zaten bilemez (bildirim uygulama kapalı
gelir).

### 48. Web push uçtan uca ölü — ve açılırsa yanlış anda izin isteyecek

`sendPush` aranınca **hiçbir çağrı yeri çıkmadı**:

```
tanim   : NotificationService.ts:55  (arayuz)
govde   : NotificationService.ts:164 (uygulama)
cagri   : YOK
```

`pushSubscription` tablosu yazılıyor (abone olma ucu), siliniyor (hesap
silme, gizlilik) ve **yalnızca `sendPush` içinde okunuyor** — yani kimse
okumuyor. `MobilePushToken` de aynı: kaydediliyor, silinebiliyor, hiç
kullanılmıyor.

**Bugün zararsız:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` tanımlı olmadığı için
`WebPushOptIn` hiç render edilmiyor. Canlıda doğrulandı — checkout'ta bildirim
kartı yok, sayfada VAPID izi yok.

**Risk gelecekte:** o anahtar bir gün "bildirimleri açalım" diye set
edildiğinde, opt-in kartı **checkout'ta** görünmeye başlayacak
(`CheckoutClient.tsx:46`) — yani kullanıcının ödeme yapmak üzere olduğu anda
tarayıcı bildirim izni istenecek. Ve hâlâ hiçbir bildirim gönderilmeyecek,
çünkü çağrı yeri yok.

Bildirim izni **geri dönüşü zor** bir kaynaktır: bir kez reddedilince
kullanıcı onu nadiren geri açar. Hiçbir şey göndermeyen bir özellik için,
üstelik ödeme anında harcanması pahalı bir güven maliyeti.

**Not — kendi işim hakkında dürüstlük:** 18. turda bu akıştaki "sonsuza kadar
donan düğme" hatasını düzeltmiştim. Düzeltme doğruydu ama akış zaten
ulaşılamaz durumdaydı; o zaman bunu fark etmemiştim, çünkü düğmeye değil
sayfaya bakmıştım.

**Karar senin:** ya `sendPush` yaşam döngüsüne bağlanır (rezervasyon onayı,
check-in, hatırlatma), ya da opt-in checkout'tan alınıp yalnızca hesap
ayarlarında bırakılır. İkisi de ürün kararı; ölçüm ve gerekçe hazır.

### "Arayüzde var, arkada yok" taraması — push dışında temiz

48 numaralı bulgudan sonra aynı soruyu bütün görünür özelliklere sordum:
**arayüz bunu vaat ediyor, arka uç gerçekten yapıyor mu?**

| Özellik | Arayüz | Arka uç | Sonuç |
|---|---|---|---|
| Kupon | checkout'ta girdi (`CheckoutClient:564`) | `couponService.claim` (`actions/booking.ts:133`) | ✅ bağlı |
| Yorum | `ReviewForm` (`BookingsClient:406`) | `addReviewAction` | ✅ bağlı |
| Favori (kalp) | `FavoriteButton` | `localStorage` — **sunucu yok, bilerek** | ✅ çalışıyor |
| Referans kodu | checkout | `actions/booking.ts:143` | ✅ bağlı |
| **Web push** | opt-in kartı | **`sendPush` çağrılmıyor** | ❌ ölü (#48) |

Favoriler cihaz-yerel: kullanıcı telefonda beğendiğini masaüstünde görmez.
Bu bilinçli ve kodda gerekçesiyle belgelenmiş bir MVP tercihi (hydration
sorunu da ayrıca çözülmüş), o yüzden kusur saymıyorum — ama üründe "favorilerim
her yerde" beklentisi doğarsa buradan başlanmalı.

Yani #48 bir desen değil, **istisna**. Bunu ölçmek önemliydi: bir ölü özellik
bulunca "acaba hepsi böyle mi" diye varsaymak kolay, ve öyle olmadığını
göstermek de bir sonuç.

### 49. Dil değiştirince arama konumu kayboluyordu

Ölçüldü: `/tr/search?lat=41.0082&lng=28.9784` üzerinde dil değiştirilince
`/en/search`e gidiliyordu — `?lat=&lng=` düşüyor ve kullanıcı aradığı konumu
kaybedip varsayılan merkeze (İstanbul) dönüyordu.

Sebep: `usePathname()` sorgu dizesini içermiyor.

Bu tam da yabancı ziyaretçinin yaptığı sey: paylaşılan ya da şehir
sayfasından gelen bir arama bağlantısını açıp **önce dili değiştiriyor**.
Aramasını kaybetmesi, dil değiştirmenin bedeli olmamalı.

`useSearchParams` bilerek kullanılmadı: o bir hook, render sırasında çalışır
ve Next'te statik sayfalarda Suspense sınırını zorunlu kılar — bu bileşen ise
**her sayfanın başlığında**. `onChange` içinde `window.location` okumak olay
anındadır ve o kısıtı hiç doğurmuyor.

### 50. Modal açılınca odak içeri girmiyordu

Ölçüldü: tarih seçici açıldıktan sonra `document.activeElement` hâlâ
tetikleyici düğme ("Bırakış"). `aria-modal="true"` bir diyalog için beklenen,
odağın içeri taşınmasıdır; taşınmayınca ekran okuyucu kullanıcısı açısından
sonuç "düğmeye bastım ama bir şey olmadı" oluyor.

Sebep `useModalBehavior` içinde:

```js
const dialogs = document.querySelectorAll('[role="dialog"]');
const dialog  = dialogs[dialogs.length - 1];   // DOM'daki SONUNCU
```

Ana sayfada **iki** `BottomSheet` var (bırakış + alış) ve ikisi de kapalıyken
bile DOM'da duruyor — kapalı olan `inert` ile erişilebilirlik ağacından
çıkarılmış. Kullanıcı birinciyi açınca hook odağı **ikincinin** ilk ögesine
taşımaya çalışıyor; o öge `inert` içinde olduğu için odaklanamıyor ve odak
tetikleyicide kalıyor. Aynı hata Tab tuzağını da yanlış diyaloğa bağlıyordu.

Düzeltme: `inert` bir ata taşıyan diyaloglar elenerek **etkin** olan seçiliyor.
Regresyon testi eklendi (kapalı diyalog DOM'da sonra gelecek şekilde kuruldu —
eski kod o testi geçemez).

**Canlıda doğrulandı:**

```
açılmadan      : 0 etkin diyalog
panel açıldı   : 1 etkin diyalog, odak İÇERİDE ("Kapat")
Escape sonrası : 0 etkin diyalog, odak tetikleyiciye döndü ("Bırakış")
```

Ayrıca `ux-sweep`'e kalıcı bir **modal odak kontrolü** eklendi: aç → odak
içeri girdi mi, Escape → kapandı mı. Bu davranış sessizce bozulabilecek
türden; artık tek komutla görünür.

### YANLIŞ ALARM — kayda geçiyor

Bu bulguya giderken önce şunu "ciddi hata" sandım: *"ana sayfada kapalıyken
bile iki `aria-modal` diyalog var, içlerinde 229 odaklanabilir kontrol; klavye
kullanıcısı görünmeyen bir takvimin içinden geçiyor."*

**Yanlıştı.** `BottomSheet` kapalı sarmalayıcıya `inert` + `aria-hidden`
veriyor. Kesin test: panel kapalıyken **40 kez Tab, diyaloğa giren durak
sayısı 0**. Beni yanıltan `checkVisibility`, `inert`'i hesaba katmıyor.

Bunu silmek yerine yazıyorum çünkü ölçüm aracının kendi kör noktası da
denetimin parçası: `checkVisibility` görünürlüğü söyler, **erişilebilirliği
söylemez**.

### Geri/ileri tuşu — SAĞLIKLI

Arama → dükkan → geri denendi: `/tr/search`e dönüyor, sayfa tam yükleniyor
(harita canvas'ı var, 2921 karakter içerik). Erken turlarda işaretlenmiş ama
hiç test edilmemiş bir maddeydi.

### Düşmanca içerik testi — düzen dayanıyor

Gerçek veriyle test etmek, veritabanına yarın ne gireceğini söylemiyor. Bu
yüzden metinler 72–216 karakterlik **boşluksuz** kelimelerle değiştirilip
ölçüldü:

| Sayfa | Normal | Uzun kelime | Uzun kelime + %200 metin |
|---|---|---|---|
| ana sayfa | 0 | 0 | 0 |
| arama | 0 | 0 | 0 |
| checkout | 0 | 0 | 0 |
| sigorta | 0 | 0 | 0 |
| dükkan detay | 0 | 0 | — |

Hiçbirinde yatay kaydırma oluşmuyor. Bu, 13. turda `overflow-wrap` için
`break-word` yerine **`anywhere`** seçmenin doğrudan karşılığı: `break-word`
min-content genişliğini küçültmediği için uzun bir dükkan adı flex satırını
patlatırdı.

Test artık taramanın kalıcı parçası — yani ileride biri o CSS kuralını
kaldırırsa tek komutla görünür.

### Yavaş bağlantı (3G) — SAĞLIKLI

400 kbps / 400 ms gecikme ile ölçüldü:

| Sayfa | İlk metin | İlk iskelet |
|---|---|---|
| `/tr` | 918 ms | 918 ms |
| `/tr/search` | 886 ms | 886 ms |

Boş beyaz ekran yok; harita iskeleti (bu denetimde eklendi) yavaş bağlantıda
görevini yapıyor ve 10 sn emniyet süpabı devrede.

### Görseller — büyük ölçüde temiz

`<img>` ögelerinin hepsinde `alt` var, ölçü aşımı yok. Tek gözlem: şehir
sayfasındaki Unsplash arka planı `w=1600` isteniyor, mobilde 340×224 CSS px
alanda çiziliyor (DPR 3 ⇒ ~1020 px yeterli) — yani **~%35 fazla**, 239 KB.
Başlangıçta "kat kat fazla" sandım, ölçünce öyle çıkmadı; küçük bir kazanç
olduğu için kod değiştirilmedi. Responsive `image-set()` ileride yapılabilir.

### Erişilebilirlik: klavye odağı SAĞLIKLI

21 sekme durağı gezildi, **hepsinde görünür odak halkası var** (0 eksik).

### Canlıda DOĞRULANAN düzeltmeler (2026-08-31)

Kod doğru diye "düzeldi" denmez; canlıda ölçüldü:

| Düzeltme | Önce | Sonra |
|---|---|---|
| Başlık taşması (FR) | 33 px kayma | **0** |
| Footer dokunma hedefi | 17 px | **32 px** |
| Mobil arama paneli | %22 (146 px), 0 kart | **%42 (279 px), 1 kart tam** |

### Sağlıklı çıkanlar (bu turda doğrulandı)

- **Farsça / RTL**: `<html lang="fa" dir="rtl">` doğru kuruluyor, düzen düzgün
  aynalanmış, yatay kaydırma yok, kırpılan metin yok. Tarihler Celali
  takvimde çıkıyor — Farsça kullanıcı için doğru olan bu.
- **Yatay kaydırma**: `/tr` ve `/fa` ana sayfalarında yok (`scrollWidth ==
  clientWidth`). Dekoratif bulanıklık öğesi (`-right-24`) 96 px taşıyor ama
  hero `overflow-hidden` taşıdığı için sayfaya kaydırma çubuğu getirmiyor.
- **Mobil alt menü** (`MobileNav`): `pb-safe` ile güvenli alan hesaba
  katılmış, hedefler `py-2` + 28 px ikon ile eşiğin üstünde.

---

## Henüz BAKILMADI (sıradaki turların işi)

Bu liste bilerek uzun; her tur birkaçını kapatıp buraya sonucunu yazın.

**Mobil (asıl risk burada)**
- [x] **ENGEL AŞILDI**: tarayıcı aracı pencereyi küçültmüyordu; mobil ölçüm
      artık repodaki Playwright ile gerçek 390×844 viewport'ta yapılıyor
      (`chromium` + `devices["iPhone 13"]`). Ana sayfa TR/EN/DE/FR/JA ölçüldü.
- [x] Arama sayfası mobilde ölçüldü (`headless: false` Cloudflare'i geçiyor):
      yatay kaydırma yok, arama girdisi ve iki tarih alanı DOM'da mevcut.
- [x] Dükkan detay ve checkout mobilde ölçüldü (yukarıda).
- [ ] Checkout 2. adım (ÖZET) ve ödeme ekranı ölçülmedi.
- [ ] Rezervasyon sonrası ekranlar (onay, QR, iptal) ölçülmedi.
- [ ] Mobil listede dükkan adları tek satıra kırpılıyor ("Galata Kulesi Emanet
      Noktası" → kesiliyor). İki satıra izin vermek (`line-clamp-2`) okunurluğu
      artırır; kullanıcı dükkanı adından seçiyor.
- [ ] Alt sayfa (bottom sheet) davranışı: snap noktaları, kaydırma kilidi
- [ ] Güvenli alan (`safe-area-inset`) — çentikli cihazlarda alt bar
- [ ] Dokunma hedefleri 44×44 px altında kalan düğmeler
- [ ] Yatay taşma (sayfanın sağa kayması) — her sayfada

**Akış**
- [x] Misafir hunisi denendi: arama → dükkan → checkout 1. adım.
- [ ] Checkout 2. adım (ÖZET) ve sonrası — hesap gerektiriyor, denenmedi.
- [ ] Boş durumlar: sonuç yok, saat kapalı, kapasite dolu — sebep söyleniyor mu
- [ ] Hata durumları: ağ kesik, action hatası, oturum düşmesi
- [ ] Geri tuşu / tarayıcı geçmişi davranışı

**Diller**
- [x] DE / FR / JA / FA ana sayfada ölçüldü — DE ve FR'de kayma bulundu, düzeltildi.
- [x] FA sağdan sola (RTL) doğru.
- [x] Dil değiştirici sayfayı KORUYOR (`/tr/search` → `/en/search`).
- [ ] İkincil sayfalar (blog, sigorta, SSS) yalnızca TR'de tarandı — hepsi temiz.

**Giriş gerektirenler — KULLANICI OTURUMU AÇMALI**
- [ ] Hesap sayfaları, rezervasyonlarım
- [ ] Partner paneli (check-in, mühür, slot yönetimi)
- [ ] Admin paneli (yeni eklenen 6 ekran dahil)

> Not: hesap açmak ve parola girmek yapabileceğim işler değil. Bu satırlar,
> tarayıcıda oturumu **sen** açtığında aynı sekmeden devam edilerek kapatılır.

**PWA**
- [ ] Gerçek cihazda kurulum akışı (Android + iOS "Ana Ekrana Ekle") — ikon
      artık ölçüm olarak doğru, ama gerçek cihazda görülmedi.
- [ ] 404 soft-404 (HTTP 200) sürüyor. Kod içindeki not `force-dynamic`in işe
      yaramadığını yazıyor; Next 16'da bu şekle özel `app/global-not-found.js`
      var (`experimental.globalNotFound`). Ama deneysel VE layout'u baypas
      ediyor (markalı ekran, dil, fontlar yeniden kurulmalı). P2 bir konu için
      prod'a deneysel bayrak açmak doğru takas değil — kayda geçirildi.
- [x] `start_url` incelendi → 19 numaralı bulgu (her açılış Türkçe)
- [ ] Bildirim ucu uçtan uca denenmedi (VAPID anahtarı gerekiyor)
- [x] `public/offline.html` silindi: hiçbir yerden referans edilmiyordu ve
      canlıda 200 dönüyordu. Çevrimdışı desteği olmayan bir üründe "offline"
      adlı bir sayfa durması, olmayan bir yeteneği vaat ediyor.

**Erişilebilirlik**
- [x] Klavye odak halkaları — sağlıklı.
- [x] Renk kontrastı ölçüldü → 17-18 numaralı bulgular (karar bekliyor).
- [x] Hareket azaltma tercihi → 22 numaralı bulgu, düzeltildi.
- [x] Yatay ekran (844×390) — taşma yok. Not: 844 px genişlik `md` kırılımını
      aştığı için yatay modda MASAÜSTÜ düzeni geliyor; alt panel yerine kenar
      paneli çıkıyor ve 390 px yükseklikte çalışıyor.
- [x] %200 metin büyütme kapandı: ana sayfada yatay kaydırma 0 (23 numaralı bulgu).
- [x] %200 büyütme altı sayfada ölçüldü (24-25 numaralı bulgular).
- [x] %200'de dükkan ve sigorta sayfalarının kaynağı izlendi (25-26).
- [x] %200 testi TR/DE/FR/JA'da tekrarlandı; kalan iki sayfa da kapandı.
- [ ] Odak tuzağı olan modallar test edilmedi.
- [ ] Ekran okuyucu ile gerçek gezinme yapılmadı.
- [ ] Etiketsiz `nav` ögeleri (arama ve checkout'ta birer tane) — `aria-label`
      eklenmeli; hangi nav olduğu izlenmedi.

### 101. Haritada OpenStreetMap atfı hiç görünmüyordu — DÜZELTİLDİ

Canlıda ölçüldü (`bagajpark.com/tr/search`, 2026-08-31): atıf kutusunun tüm
içeriği **"MapLibre"**. Tek satır OpenStreetMap kredisi yok. OSM verisi ODbL
altında; atıf bir tercih değil, lisans şartı.

Sebep iki ayrı yerde:

- `SearchMap` atfı sağlayıcının TileJSON'ından gelmeye bırakıyordu
  (`tiles.openfreemap.org/planet` içinde gerçekten var). O zincir koptuğunda —
  vektör kaynağı yüklenemediğinde — atıf da onunla birlikte kayboluyor.
- `LocationPicker` doğrudan `attributionControl: false` yazıyordu. Yani atıf
  kutusu hiç çizilmiyordu.

İkisinin de ortak yanı: hata **hiçbir belirti üretmiyor**. Harita çalışmaya
devam ediyor, yalnızca kredi kayboluyor.

Düzeltme: `MAP_ATTRIBUTION` tek kaynakta tanımlandı ve iki bileşen de
`customAttribution` ile açıkça veriyor. `map-style.test.ts` her iki dosyada
`attributionControl: false` ve eksik `customAttribution` durumunu kırmızı yakar.

### 102. Altlık otomasyon tarayıcısında hiç boyanmıyor — SORUN YOK

Belirti: `bagajpark.com/tr/search` ve localhost'ta harita alanı **bembeyaz**;
üzerinde yalnızca fiyat/`Yakında` pinleri yüzüyor. İskelet kalkıyor, yani
`map.on("load")` tetikleniyor.

Sağlayıcı tarafı ELENDİ — hepsi kabuktan doğrulandı:

| İstek | Sonuç |
|---|---|
| `styles/bright` | 200 |
| `planet` (TileJSON) | 200 |
| `sprites/ofm_f384/ofm@2x.{json,png}` | 200 |
| `planet/20260823_080002_pt/12/2456/1580.pbf` | 200, 6.105 bayt, `access-control-allow-origin: *` |

Tarayıcı ağ kaydında stil, TileJSON ve sprite istekleri **görülüyor**, ama tek
bir `.pbf` isteği yok. MapLibre karoları bir Web Worker'dan çeker; şüphe o
tarafta (otomasyon tarayıcısında worker/WebGL kısıtı).

**Neden ürün hatası sayılmadı:** kullanıcının kendi Chrome'undan aldığı ekran
görüntüsünde (2026-08-31, İstanbul araması) harita sokaklarıyla birlikte
düzgün çiziliyor. Yani en az bir gerçek tarayıcıda sorun yok.

**KAPANDI (aynı oturumda):** aynı tarayıcıda, aynı sayfada birkaç dakika sonra
alınan ekran görüntüsünde harita sokakları, suyu ve etiketleriyle **tam olarak
çiziliyor**. Yani beyazlık bir hata değil, WebGL tuvalinin ilk boyanmasından
önce alınan ekran görüntüsüydü. Bulgu burada duruyor çünkü sonraki turda aynı
yanılgıya düşülmesin: **WebGL tuvali erken alınan bir ekran görüntüsünde boş
görünebilir; "harita bozuk" demeden önce ikinci bir kare alın.**

Sağlayıcı ölçümleri yine de değerli — altlık bir gün gerçekten kaybolursa
elenecek ilk şey onlar ve hepsi 200 dönüyordu.

### 103. Kamera çalışmazsa esnaf valizi HİÇ teslim alamıyordu — DÜZELTİLDİ

Esnaf panelinde tek birincil eylem var: "Yeni valiz teslim al". O da tek bir yol
açıyordu — kamera. `QRScanner` içinde elle giriş alanı yoktu; kamera izni
reddedilmişse, webcam'i olmayan bir masaüstünde ya da misafirin telefonu bittiği
için gösterecek QR yoksa ekranda **"Kamerayı başlat"tan başka hiçbir şey**
kalmıyordu. Akış orada bitiyor, hata mesajı bile çıkmıyordu.

Ölçüm: otomasyon tarayıcısında (kamera yok) modal açıldı ve tarama alanı
süresiz döndü. Bir esnaf için bu, valizi teslim alamamak demek.

Düzeltme: kamera alanının altında **koşulsuz** görünen bir "rezervasyon kodunu
yaz" alanı. Kod ya da misafirin ekranındaki bağlantı kabul ediliyor
(`extractBookingRef` UUID'yi bağlantıdan çıkarır; kimlik yoksa metni olduğu gibi
sunucuya bırakır, çünkü sunucu imzalı QR jetonunu da çözebiliyor).

Yetki sunucuda: `getPartnerBookingPreviewAction` rezervasyonun dükkanı esnafa
ait değilse `Errors.unauthorized` döner — elle kod yazmak başka bir dükkanın
rezervasyonunu açmaz.

Uçtan uca doğrulandı: bağlantı yapıştırıldı → "Bul" → check-in kutusu misafir
adı ve valiz özetiyle açıldı. `partner-manual-checkin.test.ts` alanın kamera
hatası dalının İÇİNE kaçmasını da kırmızı yakar.

### 104. Mühür stoğu boşken ekran "sistem mühürleri atadı" diyordu — DÜZELTİLDİ

Check-in kutusu, stok boş olsa bile şunu yazıyordu: *"Sistem dükkan stoğundaki
sıradaki mühürleri atamıştır."* Alan ise bomboştu. Esnaf tezgâhta, müşteri
karşısında; ekran ona olmamış bir şeyi olmuş gibi söylüyordu.

Daha kötüsü, esnafın yapabileceğini sandığı şey de mümkün değildi: numarayı elle
yazmak sunucuda `SEAL_INVALID` ile reddediliyor (`SealService`), çünkü numara
stokta KAYITLI olmak zorunda. Yani ekran hem yanlış bilgi veriyor hem de çıkış
yolu göstermiyordu.

Ölçüm: `Sultanahmet Corner (Test)` dükkanının `Seal` tablosunda hiç kayıt yok;
ön doldurma boş dönüyor, metin yine de "atamıştır" diyor.

Düzeltme: ön doldurmanın gerçekten mühür getirip getirmediği izleniyor. Boşsa
kehribar renkli bir kutu çıkıyor: stok boş, numara elle yazılamaz, mühür talep
edin — artı "Mühür Yönetimi'ne git" bağlantısı. Mühür zorunlu ayarı açıksa
"bu rezervasyon stok gelmeden teslim alınamaz" da yazıyor; bunu düğmeye
bastıktan sonra öğrenmek en kötü an.

### 105. Check-in kapısı `open247` ve dükkanın saat dilimini yok sayıyordu — DÜZELTİLDİ

`src/services/booking/check-in.ts` doğrudan şunu çağırıyordu:

```ts
isShopOpenAt(shop.openingTime, shop.closingTime, new Date())
```

İki alan sessizce düşüyordu:

1. **`open247`.** Arama ve rezervasyon tarafı `isShopOpenForStay` kullanıyor ve
   o, 24/7 dükkanda kısa devre yapıp `true` dönüyor. `isShopOpenAt`in böyle bir
   parametresi yok. Sonuç: `open247 = true` ama `openingTime/closingTime` şema
   varsayılanında (09:00–20:00) kalmış bir dükkan aramada **22:00 slotunu
   satıyor**, misafir valiziyle geliyor ve tezgâhta check-in **reddediliyor**.
2. **Saat dilimi.** `isShopOpenAt`in varsayılanı `Europe/Istanbul`; çağrı
   dükkanın `timezone` alanını hiç geçmiyordu. Tokyo'daki bir dükkan İstanbul
   duvar saatine göre değerlendiriliyordu.

Bugün belirti üretmiyor: üretimdeki üç dükkanın üçü de Türkiye'de ve saatleri
00:00–23:59. İlk yurt dışı esnafı ya da varsayılan saatlerini değiştirmemiş ilk
24/7 dükkan ortaya çıkarır — yani 252 şehirlik talep testinin karşılığı geldiği
gün.

Düzeltme: `isShopOpenForHandover(opening, closing, open247, at, timezone)`,
`isShopOpenForStay` ile **aynı şekilde** yazıldı (önce `open247`, sonra saat) ki
ikisi bir daha ayrışmasın. Test, aramanın sattığı her anın check-in tarafından
da kabul edildiğini dört farklı saat diliminde doğruluyor ve `check-in.ts`in ham
`isShopOpenAt`e geri dönmesini kırmızı yakıyor.

### 107. Misafirin gördüğü kod ile esnafın yazdığı kod buluşmuyordu — DÜZELTİLDİ

103 numaralı düzeltme (kamera çalışmazsa elle giriş) tek başına yetmiyormuş.
Alan tam kimlik ya da bağlantı bekliyordu; ama misafirin rezervasyon ekranında
**tam kimlik hiç yazmıyor**:

```tsx
// bookings/[id]/page.tsx
<code>{booking.id.slice(0, 8).toUpperCase()}</code>   // "AA4249AD"
```

Yani gerçek senaryoda — kamera çalışmıyor, esnaf misafirden kodu okumasını
istiyor — misafir 8 haneyi okuyor, esnaf yazıyor ve sistem "bulunamadı" diyordu.
İki uç birbirini bulamıyordu; özellik kâğıt üzerinde vardı, tezgâhta yoktu.

Düzeltme: tam kimlik tutmazsa **kısa kod öneki** deneniyor. İki koruma:

- Arama **önce sahipliğe daraltılıyor**, sonra öneke bakılıyor — esnaf yalnızca
  kendi dükkanlarının rezervasyonlarını arayabilir. (Yönetici zaten hepsini
  okuyabildiği için onda daraltma yok.)
- **İki eşleşme çıkarsa hiçbiri açılmaz.** Yanlış rezervasyonu açmak, doğru
  olanı bulamamaktan kötüdür: esnaf başkasının valizini teslim alır. Alt sınır
  6 hane; daha kısası tek bir dükkanın içinde bile çakışabilir.

Yerel veritabanında doğrulandı: `AA4249AD` → tam 1 eşleşme; başka bir esnafın
kodu bu kapsamda 0 eşleşme.

### 108. "Yol Tarifi" üç yüzeyde üç türlü — DÜZELTİLDİ

Üç yerde "Yol Tarifi" bağlantısı var ve biri ayrışmıştı:

| Yüzey | Gönderdiği hedef |
|---|---|
| Arama kartı (`ShopListItem`) | `destination=<lat>,<lng>` |
| Dükkan detayı (`ShopDetailClient`) | `destination=<lat>,<lng>` |
| **Rezervasyon detayı** (`BookingDetailActions`) | **`destination=<adres metni>`** |

Fark tam da en kritik anda ortaya çıkıyor: misafir valizini taşırken bu düğmeye
basıyor. Adres metni Google tarafında yeniden geocode ediliyor ve bizim
`Shop.address` alanımız çoğu zaman ilçe/şehir kadar kaba — talep testi
noktalarında tam olarak `"<ilçe>, <şehir>"` biçiminde kuruluyor — ya da esnafın
elle yazdığı serbest metin. Yani elimizde **kesin koordinat dururken** misafir
tahmini bir noktaya yönlendirilebiliyordu.

Düzeltme: `buildDirectionsUrl` tek kaynak. Koordinat varsa koordinat, yoksa
adres metni, o da yoksa **bağlantı yok** — çalışmayan bir "Yol Tarifi" düğmesi,
olmayan düğmeden kötüdür. Üç yüzey de aynı kaynağı kullanıyor ve mandal, elle
`maps/dir` yazan bir dosyayı kırmızı yakıyor.

### 51. Kazanç hesaplayıcısının kaydırıcıları etiketsiz, sonucu sessiz — DÜZELTİLDİ

`become-partner` sayfasında giriş gerektirmeyen bir form yok, ama **iki
kaydırıcı** var: kapasite ve doluluk. Ölçüm:

| alan | erişilebilir ad |
|---|---|
| Dil seçici | "Dil" |
| kaydırıcı 1 | **yok** |
| kaydırıcı 2 | **yok** |

Etiketler ekranda duruyor ("Kapasite", "Doluluk") ama bir `<span>` içinde —
programatik bağ yok. Ekran okuyucu "kaydırıcı, 12" diyor; neyin 12'si
olduğunu söylemiyor. İkisi de arka arkaya geldiği için sırayla gezen biri
hangisinin ne olduğunu ayırt edemiyor (WCAG 4.1.2).

Üstelik bu sayfa **aday esnafı ikna etmek için** var: "ayda ne kazanırım"
sorusunun cevabı. Aracın tamamı o rakamın kaydırıcıyla değişmesi üzerine
kurulu — ve o değişim `aria-live` olmadığı için ekran okuyucuda **hiç
duyulmuyordu**. Kaydırıcıyı çekiyorsun, hiçbir şey olmuyor.

Düzeltme: `<span>` → `<label htmlFor>`, yüzde kaydırıcısına `aria-valuetext`
(yoksa "%50" değil çıplak "50" okunur), sonuç bloğuna
`aria-live="polite" aria-atomic="true"`.
