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
| 8 | İngilizcede ana sayfa arama kutusu karttan taşıyor | Ana sayfa | ⛔ BAŞKA AGENT'IN DOSYASI |

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

### 8. İngilizcede ana sayfa arama kutusu karttan taşıyor — DOKUNULMADI

Ölçüm: kart `x=941→1613`, "Find Storage Point" düğmesi `1503→1650`. **37 px
dışarı**. Satır `flex-wrap: nowrap`; İngilizce tarih metni Türkçeden geniş
olduğu için sığmıyor, buton üç satıra bölünüyor.

Dosya `src/components/guest/HomeSearchWidget.tsx` — **şu an başka bir agent
üzerinde çalışıyor**, o yüzden elleşilmedi. Düzeltmesi: satıra `flex-wrap`
vermek ya da tarih alanlarına `min-w-0` koyup butonu daraltmak.

---

## Henüz BAKILMADI (sıradaki turların işi)

Bu liste bilerek uzun; her tur birkaçını kapatıp buraya sonucunu yazın.

**Mobil (asıl risk burada)**
- [ ] Gerçek mobil genişlikte (390px) ana sayfa, arama, dükkan detay, checkout
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
