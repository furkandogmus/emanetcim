# UI/UX + PWA denetimi

Bu dosya SÜRÜYOR. Amaç: her yüzeyi tek tek gezip kanıtlı hataları yazmak, hangi
alana **henüz bakılmadığını** görünür tutmak. Bulgu kapandıkça satırı `DÜZELTİLDİ`
yapın, silmeyin — neyin neden değiştiği sonraki turda gerekiyor.

Yöntem: canlıda (bagajpark.com) tarayıcıyla gezmek + DOM ölçmek. "Sanırım şöyle"
yazılmaz; ölçüm yazılır.

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
| 13 | Harita pinleri üst üste biniyor, okunmuyor | Harita | ⏳ AÇIK |

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

### 13. Harita pinleri üst üste biniyor — AÇIK

Mobilde Fatih/Üsküdar çevresinde altı "Yakında" etiketi birbirinin üstüne
biniyor ve hiçbiri okunmuyor. Kümeleme (clustering) ya da çakışma çözümü yok.
Yakınlaştırma seviyesine göre kümelemek gerekiyor; MapLibre'de küme katmanı
standart bir çözüm.

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
- [ ] Dükkan detay ve checkout mobilde HENÜZ ölçülmedi.
- [ ] Mobil listede dükkan adları tek satıra kırpılıyor ("Galata Kulesi Emanet
      Noktası" → kesiliyor). İki satıra izin vermek (`line-clamp-2`) okunurluğu
      artırır; kullanıcı dükkanı adından seçiyor.
- [ ] Alt sayfa (bottom sheet) davranışı: snap noktaları, kaydırma kilidi
- [ ] Güvenli alan (`safe-area-inset`) — çentikli cihazlarda alt bar
- [ ] Dokunma hedefleri 44×44 px altında kalan düğmeler
- [ ] Yatay taşma (sayfanın sağa kayması) — her sayfada

**Akış**
- [ ] Misafir rezervasyon hunisi baştan sona (arama → dükkan → checkout)
- [ ] Boş durumlar: sonuç yok, saat kapalı, kapasite dolu — sebep söyleniyor mu
- [ ] Hata durumları: ağ kesik, action hatası, oturum düşmesi
- [ ] Geri tuşu / tarayıcı geçmişi davranışı

**Diller**
- [ ] DE / FR / JA / FA ekranlarında taşma ve kesilme (EN'de ikisi bulundu)
- [ ] FA sağdan sola (RTL) — `dir` uygulanıyor mu

**Giriş gerektirenler — KULLANICI OTURUMU AÇMALI**
- [ ] Hesap sayfaları, rezervasyonlarım
- [ ] Partner paneli (check-in, mühür, slot yönetimi)
- [ ] Admin paneli (yeni eklenen 6 ekran dahil)

> Not: hesap açmak ve parola girmek yapabileceğim işler değil. Bu satırlar,
> tarayıcıda oturumu **sen** açtığında aynı sekmeden devam edilerek kapatılır.

**PWA**
- [ ] Gerçek cihazda kurulum akışı (Android + iOS "Ana Ekrana Ekle")
- [ ] `start_url` locale'siz `/` → her açılışta yönlendirme; `/tr` olmalı mı
- [ ] Bildirim ucu uçtan uca denenmedi (VAPID anahtarı gerekiyor)
- [ ] Çevrimdışı: `public/offline.html` duruyor ama artık hiçbir şey kullanmıyor

**Erişilebilirlik**
- [ ] Klavye ile tam gezinme, odak halkaları, odak tuzağı olan modallar
- [ ] Renk kontrastı (özellikle gri üstü gri ikincil metinler)
