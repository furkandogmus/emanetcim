# BagajPark UX Audit ve Bounce Karsilastirmasi

Tarih: 15 Haziran 2026  
Incelenen ortam: `https://bagajpark.com`  
Kapsam: Masaustu ve mobil; ana sayfa, arama, dukkan detayi, checkout, giris/kayit,
rezervasyon yonetimi, partner giris noktasi, sigorta ve icerik sayfalari.

## Yonetici Ozeti

BagajPark'in temel marka dili ve mobil ana sayfa ilk ekrani guclu. Ancak canli
ortamda rezervasyona giden ana akista guven ve kullanilabilirlik sorunlari var.
En yuksek oncelik, arama ve checkout akisini kararlı hale getirmek; ikinci oncelik
ise iptal, guvence ve sosyal kanit mesajlarini tek bir dogru kaynaktan sunmak.

Bounce ile ana fark, Bounce'in kullaniciyi konum secimine odaklayip detaylari
kademeli istemesi ve gercek sosyal kaniti arama formunun hemen altinda gostermesi.
BagajPark ise tarihi ve valiz adedini hizli topluyor fakat arama sonucunda ve
checkout'ta ayni bilgileri tekrar tekrar gostererek kullanicinin karar verme
yukunu artiriyor.

## P0 - Rezervasyonu Engelleyen Sorunlar

- [x] **Maestro Guest rezervasyonlar sayfasindaki canli hatayi gider.**
  - Gozlem: Basarili Maestro Guest girisinden sonra `/tr/bookings`, rezervasyon
    listesi yerine `Eyvah, bir sorun oldu!` genel hata ekranini gosteriyor.
  - Etki: Giris yapan misafir rezervasyonunu, QR kodunu veya gecmisini goremez.
  - Kabul kriteri: Maestro Guest ile `/tr/bookings` acilir; aktif/gecmis
    rezervasyonlar veya anlamli bos durum gorunur.
  - Tamamlandi: Servisin `{ items, total }` cevabi yerine rezervasyon dizisi
    istemciye gonderiliyor.

- [ ] **Arama sayfasindaki aralikli 502 hatasini gider.**
  - Gozlem: `/tr/search` ilk denemede Cloudflare `502 Bad Gateway` verdi, sonraki
    denemede yuklendi.
  - Etki: Ana sayfadaki birincil CTA zaman zaman tamamen calismiyor.
  - Kabul kriteri: 24 saatlik sentetik kontrolde `/tr/search` basari orani en az
    `%99.9`; 5xx olursa kullaniciya markali hata/fallback ekrani gosterilir.
  - 2026-08-21 durumu: 48 saatlik nginx log'unda 0 adet 502, web container hic
    restart olmamis (`RestartCount: 0`), 20/20 canli deneme basarili — su an
    tekrar uretilemiyor. Muhtemelen daha once yapilan baska duzeltmelerin yan
    etkisi. Kesin kapatmak icin senkron izleme (Uptime Kuma, bkz.
    `[[hetzner-sertlestirme]]` Faz 4) gerekiyor — henuz kurulmadi.

- [x] **Masaustunde mobil bottom sheet'in render edilmesini engelle.**
  - Gozlem: 1280px masaustunde sol arama paneli ile bottom sheet ayni anda
    gorunuyor; sekmeler ve dukkan kartlari iki kez render ediliyor.
  - Etki: Haritanin yarisi kapanıyor, DOM ve erisilebilirlik agaci iki katina
    cikiyor, kullanici hangi paneli kullanacagini anlayamiyor.
  - Muhtemel alanlar: `SearchClient`, `BottomSheet`.
  - Kabul kriteri: `md` ve ustunde sadece sol panel; mobilde sadece bottom sheet.
  - Tamamlandi: Mobil bottom sheet `md` ve ustunde tamamen gizlendi; alt dukkan
    listesi kaldirilarak mobilde yalnizca sekmeler birakildi.

- [x] **Mobil checkout CTA ve alt navigasyon cakismasini duzelt.**
  - Gozlem: `Devam` butonu, mobil alt navigasyonun ustune biniyor. Sol altta
    `Common.mobileNavBack` anahtari kirpilmis sekilde gorunuyor.
  - Etki: CTA ve navigasyon ayni dokunma alanini paylasiyor; geri aksiyonu
    anlasilmiyor.
  - Muhtemel alanlar: `MobileNav`, checkout footer/sticky CTA.
  - Kabul kriteri: Sticky CTA ile mobil nav arasinda en az `12px` bosluk ve safe
    area destegi; ham ceviri anahtari gorunmez.
  - Tamamlandi (2026-08-21), Playwright ile canlida dogrulandi: CTA'nin alt
    kenari nav'in ust kenarini ~8.4px asiyordu (footer `pb-4.5rem`=72px, nav
    gercek yuksekligi ~80px) -> `pb-6rem`'e cikarildi (`CheckoutClient.tsx`,
    ayni desen `PWAInstallBanner.tsx`'te de vardi, o da duzeltildi).
    `Common.mobileNavBack` hic tanimlanmamis bir anahtidi — var olan
    `Common.back`'e degistirildi (`MobileNav.tsx`). Yan bulgu: fransizca
    `Common.back` = "Dos" (vucut sirti) yanlis ceviriydi, "Retour" yapildi.

- [x] **Checkout mobil acilisinda tarih secicinin kendiliginden acilmasini engelle.**
  - Gozlem: Checkout sayfasi mobilde yenilendiginde `Tarih Sec` bottom sheet'i
    DOM'da acik geliyor.
  - Etki: Kullanici valiz secimi adimindayken beklenmeyen modal ile karsilasiyor.
  - Kabul kriteri: Tarih secici yalnizca ilgili tarih alanina dokunuldugunda acilir.
  - Dogrulandi (2026-08-21): Playwright ile canlida test edildi, tarih secici
    varsayilan olarak KAPALI geliyor — bu madde audit'ten sonra duzelmis.

## P1 - Guven, Donusum ve Akis Tutarliligi

- [ ] **Partner ana panelini masaustu ve mobil icin ayri duzenle.**
  - Gozlem: Masaustunde partner ana paneli, genis ekranda ortada kalan mobil
    kamera karti ve ikon navigasyonu gibi gorunuyor; ekranda cok fazla bos alan
    var. Mobilde buyuk kamera karti ve panel navigasyonu, alttaki aktif emanet ve
    hakedis metriklerinin ustune biniyor.
  - Kabul kriteri: Masaustunde operasyon ozeti, bekleyen aksiyonlar ve son
    rezervasyonlar ayni ilk ekranda gorunur; mobil navigasyon hicbir metrigi
    kapatmaz.

- [x] **Admin sistem sagligi puanini gercek servis durumundan hesapla.**
  - Gozlem: `/tr/admin/status` sayfasinda SMS gecidi `UYARI / Credentials: Eksik`
    oldugu halde genel puan `100 / 100` ve `Kritik Hata Yok`.
  - Etki: Operasyon ekibi sistemin gercek hazirlik durumunu yanlis yorumlayabilir.
  - Kabul kriteri: Eksik entegrasyonlar agirlikli saglik puanini dusurur ve
    aksiyon sahibi/sonraki adim gosterilir.
  - Tamamlandi: Veritabani, auth, e-posta ve SMS durumlari agirlikli puana
    baglandi; eksik servisler uyari/hata durumunu ve puani degistiriyor.

- [x] **Guest hesap ekranini gercek kullanici merkezi haline getir.**
  - Gozlem: `/tr/account` sadece referans kodu, gizlilik ve rezervasyon
    baglantilarindan olusuyor; masaustunde sayfanin buyuk kismi bos.
  - Kabul kriteri: Yaklasan rezervasyon, son rezervasyon, destek, profil ve
    hesap guvenligi aksiyonlari gorunur.
  - Tamamlandi: Rezervasyon, yeni nokta bulma, destek, gizlilik ve referans
    aksiyonlari responsive bir hesap merkezinde toplandi.

- [ ] **Partner rezervasyon kartlarini operasyon hizina gore sadeleştir.**
  - Gozlem: Kartlarda uzun durum aciklamasi ve cok uzun check-in/check-out CTA
    metinleri var. Mobilde CTA iki satira dusuyor ve kartin buyuk bolumunu kapliyor.
  - Kabul kriteri: Durum, zaman ve bir sonraki aksiyon tek bakista anlasilir;
    birincil CTA kisa ve tek satirliktir.

- [ ] **Admin gelen kutusuna spam ve toplu islem akisi ekle.**
  - Gozlem: Gelen kutusunun buyuk kismi SEO/satis spami; her kayitta yalnizca tek
    tek silme aksiyonu bulunuyor.
  - Kabul kriteri: Coklu secim, spam olarak isaretleme, toplu silme, okunmamis ve
    gercek destek talebi filtreleri bulunur.

- [ ] **Admin tablo aksiyonlarini metin/tooltip ve onay ile guclendir.**
  - Gozlem: Kullanici ve esnaf yonetimi ekranlarinda kritik aksiyonlar masaustunde
    yalnizca ikonla gosteriliyor. Mobilde cok sayida ikonun anlami belirsiz.
  - Kabul kriteri: Banlama, rol verme, sifre sifirlama ve silme aksiyonlari
    acik etiket/tooltip, yetki kontrolu ve onay adimi tasir.

- [x] **Guvence tutarini 10.000 TL olarak esitle.**
  - Tamamlandi: Sigorta sayfasi ve tum dil dosyalarinda guvence tutari
    `10.000 TL` karsiligina guncellendi.
  - Kaynak ornekleri: `src/app/[locale]/insurance/page.tsx`, `src/locales/*.json`.

- [x] **Iptal politikasindaki celiskileri gider.**
  - Gozlem: Ayni checkout ozetinde:
    - "teslim saatine kadar tam iade"
    - "24 saat oncesine kadar ucretsiz iptal"
    - "1 saatten az kala nakit yerine kredi"
    mesajlari birlikte gorunuyor. Sartlar sayfasinda farkli bir zaman araligi var.
  - Kabul kriteri: Tek politika motoru ve tek metin kaynagi; her ekranda ayni
    rezervasyon icin ayni sonuc.
  - Tamamlandi (2026-08-21): Kod incelemesi gercek kaynagi ortaya cikardi —
    `BookingService.cancelBooking()` check-in zamanina BAKMAKSIZIN her zaman tam
    nakit iade yapiyor ("Bounce-style: full refund", koddaki acik yorum).
    `lib/cancellation-policy.ts` (kademeli "1 saat alti kredi" hesaplayan, ama
    hicbir yerde gercek iptal akisina baglanmayan) modul + onu kullanan
    `CancellationPolicy.tsx` UI bileseni SILINDI/sadelesti. FAQ (`FAQ.a2`, 14
    dil), checkout callout (`checkoutPolicyCalloutBody`), iptal sayfasi
    (`cancellation/page.tsx`) ve sozlesme (`terms/page.tsx` 10.1) tek mesaja
    hizalandi: "check-in'e kadar her zaman ucretsiz iptal, tam iade".

- [x] **Rezervasyon yonetimi sayfasindaki ham ceviri anahtarlarini duzelt.**
  - Gozlem: Mobilde alan etiketleri `GUEST.EMAIL` ve `GUEST.BOOKINGID`.
  - Kabul kriteri: Tum desteklenen dillerde insan tarafindan okunur etiketler.
  - Tamamlandi (2026-08-21): `Guest.email`/`Guest.bookingId` 14 dilin hepsine
    eklendi (`src/locales/*.json`, `ManageLookupForm.tsx`).

- [x] **Checkout'taki Ingilizce metinleri yerellestir.**
  - Gozlem: Turkce checkout'ta `Available Time Slots`, `1 bag selected`, `ready`.
  - Kaynak ornegi: `src/components/guest/SlotAvailabilityGrid.tsx`.
  - Kabul kriteri: Ceviri anahtari taramasinda Turkce akista sabit Ingilizce metin yok.
  - Dogrulandi (2026-08-21): dosya zaten `isTr` kontrolu ile TR/EN ayirimi
    yapiyor (audit tarihinden sonra baska bir degisiklikle duzelmis olmali) —
    "ready" ifadesi bu dosyada bulunamadi, baska bir yerde olabilir, izlemede.

- [ ] **Checkout zaman secimini sadeleştir.**
  - Gozlem: Kullaniciya arka arkaya onlarca yarim saatlik buton gosteriliyor;
    ardindan ayrica teslim ve teslim alma tarih alanlari geliyor.
  - Bounce farki: Konum, tarih ve canta bilgisi kademeli ve tek birer kontrolle
    toplanıyor.
  - Kabul kriteri: Tek tarih-saat araligi secici; yalnizca gercekten musait
    alternatifler gosterilir; tekrar eden kontroller kaldirilir.

- [ ] **Arama sonucunda tekrar eden icerigi kaldir.**
  - Gozlem: Masaustunde `Yakindaki / Tum Noktalar` ve ayni dukkan karti iki kez
    gorunuyor.
  - Kabul kriteri: Her breakpoint'te tek sonuc listesi ve tek sekme grubu.

- [ ] **Dukkan detay sayfasinin ilk ekranini karar vermeye uygun hale getir.**
  - Gozlem: Masaustunde buyuk bos alan var; konum, yorum ve guven bilgileri ilk
    ekranda zayif kaliyor; sticky rezervasyon butonu icerigi kapatiyor.
  - Bounce farki: Karar icin fiyat, mesafe, saat, yorum ve guven sinyalleri ayni
    baglamda sunuluyor.
  - Kabul kriteri: Ilk ekranda dukkan gorseli/harita, mesafe, calisma saati,
    puan/yorum, fiyat ve CTA birlikte gorunur.

- [x] **Sosyal kanit mesajlarini gercek veriyle uyumlu yap.**
  - Gozlem: Canli istatistikler `0 tamamlanan depolama`, `0 misafir yorumu`
    gosterirken alt bolum `4.8 / 5 dogrulanmis yorumlar` diyor.
  - Ayrica ana sayfada `3 aktif nokta` varken "yuzlerce emanet noktasi" deniyor.
  - Bounce farki: Lokasyon, saklanan canta ve puan iddialari net ve birbirini
    destekliyor; yeni yorumlar dogrudan gorunuyor.
  - Kabul kriteri: Gercek veri yoksa iddia gizlenir veya "yeni" durumuna uygun
    guven mesaji kullanilir.
  - Dogrulandi (2026-08-21): Canli kontrol edildi — trust-stats bolumu
    (`src/app/[locale]/page.tsx`) gercek DB verisini gosteriyor (3/0/0/"—"),
    "yuzlerce nokta" veya sabit "4.8/5" iddiasi kod tabaninda bulunamadi (audit
    tarihinden sonra kaldirilmis olmali). `TestimonialCarousel` de bos veride
    `null` donuyor, sahte yorum yok. Ek bulgu: canli DB'de "Furkan'in Diger
    Mekan" adinda bir test dukkani `isActive=true` olarak aramada gorunuyordu —
    bu SADECE veritabani mutasyonu gerektirdigi icin (kod degisikligi degil)
    guvenlik siniflandiricisi tarafindan bloklandi, kullanicinin admin panelden
    (`/admin/partners`) elle pasife cekmesi gerekiyor.

- [x] **Partner kazanimi baglantilarini tek hedefe yonlendir.**
  - Gozlem: Header `Partner Ol` kayit sayfasina; footer `Esnafimiz Olun`
    `/partners` uzerinden giris sayfasina; `/become-partner` ise ayri tanitim
    sayfasina gidiyor.
  - Kabul kriteri: Tum halka acik partner CTA'lari tek tanitim/basvuru funnel'ina
    gider; giris yapmak isteyen partner icin ayri CTA bulunur.
  - Tamamlandi (2026-08-21): `/partners` audit'ten sonra zaten gercek bir
    tanitim/basvuru sayfasina donusmus (kendi CTA'lari `/register?role=PARTNER`'a
    gidiyor), `/become-partner` da kendi CTA'lariyla `/partners`'a yonleniyor —
    ikisi zaten tek hedefe akiyordu. Tek kalan tutarsizlik: Header'daki
    "Partner Ol" hala rolsuz `/register`'a gidiyordu (footer ile uyumsuz) —
    `/partners`'a yonlendirildi (`src/components/layout/Header.tsx`).

- [x] **Urun/SEO basliklarindaki tekrarları temizle.**
  - Gozlem: Bazi title'lar `... | BagajPark | BagajPark`.
  - Kabul kriteri: Her sayfada tek marka suffix'i ve benzersiz title/description.
  - Tamamlandi (2026-08-21): Kok neden `src/app/[locale]/layout.tsx`'teki
    `title.template: "%s | BagajPark"` — tekil sayfalar (`guest-static-seo.ts`,
    14 locale JSON'daki `metaTitle`/`indexMetaTitle`) KENDİLERİ de suffix
    ekliyordu. Suffix'i tekil sayfalardan kaldirildi, artik tek kaynak
    (template) yonetiyor.

## P2 - Gorsel Kalite ve Kullanilabilirlik

- [ ] **Rol bazli panel navigasyonunu tutarli hale getir.**
  - Guest, partner ve admin ekranlari farkli navigasyon kaliplari kullaniyor.
    Partner ana panelinde ikinci bir ikon navigasyonu, mobilde ayrica global alt
    navigasyon hissi yaratiyor.

- [ ] **Panel bos durumlarini daha faydali tasarla.**
  - Admin basvurular ekraninda bos tablo genis bir beyaz alan olarak kaliyor.
    Bos durumda yeni basvuru sureci, filtre temizleme veya dokumantasyon aksiyonu
    sunulabilir.

- [ ] **Partner gelir metriklerinde dil ve veri aciklamasini iyilestir.**
  - `14s Ort. Sure`, `%67 Donusum`, `— Puan` metriklerinin nasil hesaplandigi
    belirsiz. `%50` komisyon mesaji cok baskin fakat odeme takvimi gorunmuyor.

- [ ] **Masaustu panel sayfalarinda icerik yogunlugunu dengele.**
  - Guest hesap, partner ana paneli ve admin bos durum sayfalari cok genis bos
    alan birakiyor; operasyon sayfalari ise ayni anda cok yogun tablo sunuyor.

- [ ] **Mobil sayfalarda header + alt nav + sticky CTA dikey alanini optimize et.**
  - Ana sayfa ilk ekrani temiz; ancak form/checkout sayfalarinda sabit elemanlar
    kullanilabilir alani ciddi bicimde daraltiyor.

- [ ] **Dukkan kartlarinda anlamsiz metrikleri gizle.**
  - Gozlem: `0` puan, `≤0dk` yanit suresi ve test dukkan adlari canli ortamda.
  - Kabul kriteri: Veri yoksa metrik gizlenir; prod'da test isimli dukkan bulunmaz.

- [ ] **Fiyat dilini tutarli yap.**
  - Gozlem: Arama kartinda "baslangic ₺50 / gun", dukkan detayinda tum boyutlar
    ayni fiyat, checkout'ta boyut secimi tekrar isteniyor.
  - Kabul kriteri: Karttan checkout'a fiyat beklentisi degismez; "baslangic"
    yalnizca gercek fiyat farki varsa kullanilir.

- [ ] **Giris/kayit sayfalarinda gereksiz uzun dikey boslugu azalt.**
  - Gozlem: Mobilde form kartindan footer'a kadar buyuk bosluk var; footer
    Product Hunt rozeti karar aninda dikkat dagitiyor.
  - Kabul kriteri: Auth sayfalarinda odak form ve gerekli guven/hukuk linklerinde.

- [ ] **404 ve hata sayfalarindaki ceviri anahtarlarini denetle.**
  - Gozlem: Bulunamayan dukkan/checkout sayfasinda `Common.mobileNavBack`
    gorunebiliyor.
  - Kabul kriteri: CI'da tum locale anahtarlarinin varligini dogrulayan test.

- [ ] **Harita ve liste dengesini breakpoint bazli test et.**
  - Kabul kriteri: 390, 768, 1024, 1280 ve 1440 genisliklerinde harita, panel,
    kartlar ve CTA'lar birbirini kapatmaz.

## Bounce'tan Alinabilecek Akis Ilkeleri

1. **Konum once, detay sonra:** Ilk karar "nerede"; tarih ve canta ikincil
   kontroller olarak ilerler.
2. **Tek ve guclu form:** Ayni veri sonraki ekranlarda tekrar sorulmaz.
3. **Gercek sosyal kanit:** Arama formunun hemen altinda guncel yorum, lokasyon
   sayisi ve puan bulunur.
4. **Karar sinyalleri birlikte:** Fiyat, saat, konum, yorum, iptal ve koruma
   kullanicinin dukkan secim aninda gorulur.
5. **Politika netligi:** Ucretsiz iptal ve koruma tek, kolay anlasilir cumleyle
   sunulur; detaylar ikincil katmanda acilir.

## Onerilen Uygulama Sirasi

1. Arama 5xx izleme ve duzeltme.
2. Responsive render ayrimi: masaustu sidebar / mobil bottom sheet.
3. Mobil checkout sticky CTA, alt nav ve tarih secici duzeltmeleri.
4. Guvence ve iptal politikasini tek kaynakta birlestirme.
5. Ceviri anahtarlari ve sabit Ingilizce metinlerin temizlenmesi.
6. Checkout zaman seciminin sadeleştirilmesi.
7. Dukkan detay ve arama kartlarinin karar sinyalleriyle yeniden duzenlenmesi.
8. Partner funnel ve sosyal kanit mesajlarinin duzeltilmesi.
9. Rol bazli staging smoke hesaplari ve otomatik gorsel regresyon testleri.

## Onerilen Test Paketi

- [ ] Playwright: ana sayfa CTA -> arama -> dukkan -> checkout ozet.
- [ ] Playwright: mobilde sticky CTA ile bottom nav cakisma kontrolu.
- [ ] Playwright: desktop'ta bottom sheet gorunmezlik kontrolu.
- [ ] Playwright: tum public CTA'larda 2xx/3xx hedef kontrolu.
- [ ] Playwright: partner tanitim ve partner giris rotalarinin ayrimi.
- [ ] Unit: iptal politikasinin tek kaynak sonucu.
- [ ] Unit: guvence tutarinin tum locale'larda ayni kaynakla uretilmesi.
- [ ] CI: ham ceviri anahtari ve sabit Ingilizce UI metni taramasi.
- [ ] Gorsel regresyon: 390x844, 768x1024, 1280x720, 1440x900.

## Inceleme Notlari

- Canli arama sayfasi inceleme sirasinda bir kez `502`, sonraki denemelerde `200`
  dondu. Bu nedenle sorun aralikli gorunuyor.
- Maestro misafir, partner ve admin hesaplariyla canli ortamda oturum acilmasi
  ve rol bazli panel ekranlari dogrulandi.
- Incelenen rol ekranlari:
  - Guest: ana sayfa, hesap, rezervasyonlar.
  - Partner: ana panel, rezervasyonlar, kazanc, muhurler, ayarlar.
  - Admin: ana panel, basvurular, esnaflar, kullanicilar, muhurler, gelen kutusu,
    sistem durumu.
- Son rezervasyonu olusturan `Rezervasyonu Tamamla` aksiyonu calistirilmadi.
