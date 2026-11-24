# Ürün ve iş kuralları

Bu belge BagajPark'ın ne yaptığını, rezervasyonun hangi kurallarla ilerlediğini ve
sahada (dükkan, destek, mühür) nasıl işlediğini tek yerde anlatır. Eski PRD, kullanım
senaryoları, iş kuralı matrisi, bildirim matrisi, partner el kitabı, personel listesi,
tedarik planı, destek/SLA, hukuki altyapı ve uygulama matrisi belgelerinin yerine
geçer (2026-11-23). Her kural kodda karşılığı olan haliyle yazıldı; kodda olmayan bir
vaat buraya girmez, `docs/BACKLOG.md`'ye girer.

Ayrıntılı kaynaklar: ödeme `docs/PAYMENTS.md`, sayısal kurallar
aşağıdaki § Platform ayarları, zamanlanmış işler `scripts/README.md`, açık işler ve
kararlar `docs/BACKLOG.md`. Eski `PLATFORM_SETTINGS.md` 2026-11-23'te buraya katıldı.

## Son durum — 2026-11-23

- **Kanallar:** web (`bagajpark.com`, Next.js 16; 6 dil: tr, en, de, fr, ja, fa —
  `src/i18n/locales.ts`), mobil Expo uygulaması (`mobile-expo/`): iOS App Review'da,
  Android sürümleri Google Play kapalı test izine (`release:android`) çıkıyor (`mobile-expo/IOS_YAYIN.md`, `PLAY_YAYIN.md`).
  Siteye mağaza tanıtımı `iosAppStoreLive` / `androidPlayLive` bayraklarıyla açılır.
- **Ödeme:** online tahsilat yok. Sağlayıcı `manual`; misafir dükkanda öder, tahsilat
  check-in anında deftere yazılır. Platform komisyonu bugün 0 (`docs/PAYMENTS.md`).
- **Fiyat:** valiz başına günlük sabit fiyat (varsayılan 250 TL), boydan bağımsız.
  Boy çarpanı altyapısı hazır, açılması iş kararı.
- **Güvence:** şartlar sağlandığında valiz başına 10.000 TL'ye kadar (Kullanım
  Şartları); misafirden ayrıca güvence bedeli alınmaz. Bağımsız sigorta poliçesi değildir.
- **Yönetim:** web `/admin` ve mobil yönetici sekmesi aynı servisleri kullanır:
  rezervasyon yönetimi, duyuru (broadcast), kullanıcılar ve rol onayı, dükkanlar
  (fotoğraf, çalışma saati, yorum moderasyonu), itirazlar, kuponlar, ödemeler,
  platform ayarları, özellik bayrakları, inceleme (App Review) hesabı.
- **Sürüyor (birleşmedi):** ortaklık (affiliate) programı (#207), anlık dükkan slotları
  ve esnaf adayı dönüşümü (#208).

## Roller

| Rol | Kim | Nerede |
|---|---|---|
| `GUEST` | Misafir (gezgin) | web, mobil |
| `PARTNER` | Dükkan sahibi (esnaf) | web `/partner`, mobil esnaf sekmesi |
| `ADMIN` | Platform yöneticisi | web `/admin`, mobil yönetici sekmesi |

**Dükkan personeli** (2026-11-24) bir rol değil, `ShopMember` üyeliğidir: personel `PARTNER`
olmaz (onboarding, merchant hesabı yok), yalnız operasyon yapar (rezervasyon, QR, teslim al/et,
gelmedi, valiz revizyonu, misafiri bekle, mühür stoğu/kargo/arıza). Kazanç, ödeme/banka, dükkan
ayarları, afiş, iptal ve ekip sahipte kalır. Sahip e-postayla davet eder (dükkan başına 10,
davet bağı 7 gün, tek kullanımlık, yalnız davet edilen adresin hesabında kabul edilir) ve çıkarır;
yetki her istekte veritabanından okunur (`src/lib/shop-access.ts`: `operate` / `manage`).

Rol yükseltme dört göz ilkesiyle onaylanır (`AdminRoleChangeRequest`, `/admin/role-approvals`);
son yönetici düşürülemez. Giriş: e-posta + şifre, Google, Apple (web ve iOS). SMS ile
giriş kapalı (`SMS_LOGIN_ENABLED`); OAuth kurulumu `docs/GUVENLIK_VE_IZLEME.md` § Kimlik doğrulama.

## Rezervasyon yaşam döngüsü

```
APPROVED ──check-in (tahsilat)──> PAID ──> CHECKED_IN ──check-out──> CHECKED_OUT
    │                                                │
    └── iptal / ret / geç bırakma ──> CANCELLED      └── zorla teslim (yönetici)
```

- Misafir rezervasyonu `APPROVED` olarak doğar; esnaf onayı beklenmez (web
  `createBookingAction` ve mobil `checkout/intent` aynı servisi çağırır,
  `src/services/booking/create.ts`). `WAITING_APPROVAL` eski talep akışından kalan
  durumdur; esnaf onay/ret modülü (`partner-review.ts`) onu hâlâ işler.
- **Rezervasyon hesap ister** (2026-11-23, web ve mobil). Oturumsuz istek kupon,
  kapasite ve slot işine girmeden `login_required` alır; kapı serviste
  (`LOGIN_REQUIRED`) ve web action'ında. Web checkout oturumsuz misafiri giriş/kayıt
  ekranına gönderir; dönüş adresi dükkanı, günleri, valizleri ve kuponu taşır
  (`src/lib/checkout-return-url.ts`), aracı çerezi (`bp_aff`) girişten etkilenmez.
  Daha önce açılmış hesapsız rezervasyonlar çalışmaya devam eder: e-postadaki
  yönetim bağlantısı, `/bookings/lookup`, misafir iptali, valiz revizyonu onayı ve
  e-posta doğrulanınca hesaba bağlama.
- Kapasite kontrolü slot satırları üzerinde kilitle yapılır (`ReservationSlot`);
  platform tatil günleri ve dükkan kapanışları (`ShopClosure`, `ShopWeeklyHours`)
  rezervasyonu reddeder. Bırakma takviminde geçmiş günler seçilemez.
- **Check-in** (`check-in.ts`): esnaf QR'ı okutur ya da kodu arar. QR imzalı JWT'dir
  (`src/lib/qr-token.ts`, en az 48 saat geçerli). Manuel sağlayıcıda tahsilat bu anda
  deftere yazılır, sonra durum `CHECKED_IN` olur. Mühür kaydı `requireSealsOnCheckIn`
  açıksa zorunludur (varsayılan kapalı). Kapanıştan sonra `checkInGraceMin` (30 dk)
  tolerans var; dükkan kapalı görünüyorsa yalnızca sahip/yönetici "yine de teslim al" diyebilir
  (olaya `outside_hours` yazılır). Dükkan personeli bu istisnayı göremez ve kullanamaz
  (`canOverrideClosedHours`); saatleri sahip düzeltir ya da teslimi o onaylar.
- **Valiz revizyonu** (`bag-revision.ts`): gelen valiz sayısı farklıysa esnaf düzeltir,
  tutar yeniden hesaplanır.
- **Check-out** (`check-out.ts`): gecikme ücreti ve erken teslim iadesi hesaplanır ve
  esnafa önceden gösterilir; mühürler `RETURNED`'a çekilir.
- Her geçiş `BookingEvent`'e iz bırakır.

## İş kuralları

| Konu | Kural | Kaynak |
|---|---|---|
| İptal | Check-in saatine kadar ücretsiz; dükkanda ödeme olduğu için tahsilat yapılmaz | `lifecycle.ts`, `/cancellation` sayfası |
| Geç bırakma | Bırakma saatinden sonra misafire +15/+30/+45 dk hatırlatma, +45'te esnafa da; +60 dk'da `no_show` ile otomatik kapanış. Esnaf "Misafiri bekle" ile kapanışı 30 dk erteler (alma saatini aşamaz). Ödemesiz niyet sessiz kapanır | `LateDropoffService`, `late-hold.ts`, `late-dropoff-scan` (5 dk) |
| Geç teslim alma | `latePickupGraceMin` (15 dk) sonrası `latePickupFeeTry` (varsayılan 0); tahsilat esnafta | `check-out.ts`, `docs/PAYMENTS.md` |
| Valizi dükkanda kalan misafir | Push + e-posta hatırlatma takvimi (168 saate kadar) | `OverdueGuestReminderService`, `booking-reminders` |
| Kapanmamış rezervasyon | Süre aşımı taraması yalnız tespit eder, durum değiştirmez; karar operasyonundur | `OverdueBookingService`, `overdue-scan` |
| Yorum | Check-out sonrası 1-5 yıldız + metin (en çok 2.000 karakter); hemen yayınlanır, yönetici gerekçeyle gizler | `ReviewService` |
| Hasar / kayıp | Misafir itirazı valiz dükkandayken ya da teslimden (check-out) sonraki **14 gün** içinde açar; sonra `window_closed` alır. Yönetici durumu her zaman değiştirir (yeniden açma dahil). Karar check-in mühür kaydı ve valiz durumu fotoğraflarıyla verilir; fotoğraflar 30 gün saklandığı için pencere içindeki itirazın kanıtı durur. Fotoğraflar silindikten sonra yönetici bir itirazı yeniden açarsa kanıt geri gelmez, ek işlem yoktur | `DisputeService`, `src/lib/dispute-window.ts` |
| Valiz durumu fotoğrafı | Teslimde sahip/personel isteğe bağlı 1-3 kare çeker (teslim öncesi ya da teslimden sonraki 60 dk; sonra kilitli, yalnız yönetici siler). Nesne özel (`bag-photos/`), okuma yetki kontrolünden sonra 5 dk'lık imzalı adresle: misafir biletinde, dükkan, yönetici rezervasyon ve itiraz ekranında. Teslimden 30 gün sonra silinir; itiraz açıksa kapanmasından 30 gün sonra; hiç kapanmamış rezervasyonda planlı bitişten 30 gün sonra (teslim alınmamış rezervasyonda ekleme planlı bitişte kapanır). Nesnesi S3'te kalmamış satırı günlük iş temizler. Yükleme hatası teslimi engellemez | `BagPhotoService`, `bag-photo-retention` |
| Kupon | Yönetici tanımlar (`/admin/coupons`, mobil "Kuponlar"); iptalde kupon iade edilir | `CouponService` |
| Davet indirimi | Başka bir misafirin kodu, ilk rezervasyonda, kuponsuz, ara toplamdan `REFERRAL_DISCOUNT_PCT` (varsayılan %5) | `ReferralService` |
| Uygulama indirimi | Mobil uygulamadan yapılan rezervasyona platform geneli `appBookingDiscountPct` (varsayılan %10, 0 = kapalı); aşağıda | `src/lib/app-discount.ts`, `CheckoutDiscountService` |
| Yönetim bağlantısı | Eski hesapsız rezervasyonun yönetim bağlantısı en fazla 7 gün geçerli; yeni hesapsız rezervasyon açılmaz | `guest-link.ts` |

### Uygulama indirimi (2026-11-24)

- **Kim alır:** yalnızca mobil uygulamanın ödeme uçlarından (`/api/mobile/checkout/quote`,
  `/intent`) gelen rezervasyon. Kanal rotadan türetilir; istemci fiyat ya da bayrak
  gönderemez. Web rezervasyonu tam fiyattır.
- **Sıra (sektörde yaygın "kanal fiyatı + kod" düzeni):** uygulama indirimi ara toplamdan
  (sigorta dahil) **önce** düşülür; kupon, davet ya da aracı indirimi (tek indirim kuralı
  değişmeden) **kalan tutara** uygulanır. Kuponun asgari tutar şartı da kalan tutara bakar.
  Örnek: 250 TL → %10 uygulama → 225 TL → %20 kupon → 180 TL.
- **Yuvarlama:** kuruşa, yarım kuruş yukarı (`applyAppDiscount`).
- **Defter:** doğruluk kaynağı `Booking.appDiscountAmount` (TRY). `pricingSnapshot.appBookingDiscountPct`
  yalnızca uygulama rezervasyonunda uygulanan oranı taşır; web rezervasyonunda 0'dır, canlı
  ayar değildir. Esnaf kazancı, yönetici ciro özeti ve e-postalar indirimli `totalPrice`ı kullanır.
  Düzenleme ve valiz revizyonunda tutar kupon gibi kilitli kalır (`lockedBookingDiscount`).
- **Erken teslim iadesi** ödenen fiyattan: kalan günlerin liste tutarı, ödenen hizmet / liste
  hizmet oranıyla çarpılır (uygulama, kupon, davet, aracı indirimi hepsi düşer; oran 1'i aşmaz).
- **Arama kartı:** mobil tarihli aramada `stayQuote.total` uygulama fiyatıdır (ödeme ekranıyla
  aynı sayı), `fullTotal` üstü çizili gösterim içindir.
- **Oran** iki ondalığa yuvarlanır (`Decimal(5,2)`), denetim kaydı saklanan değeri yazar.
- **Bedel:** komisyon bugün 0 olduğu için indirimi esnaf karşılar (sahip kararı). Oran değişikliği
  bu yüzden riskli alandır (onay ifadesi) ve denetim kaydına eski → yeni yazılır.
- **Gösterim:** mobil dükkan detayı ve ödeme ekranında üstü çizili fiyat + "Uygulama fiyatı"
  (sunucu alanları `appPrice`, `appDiscount`). Web dükkan ve ödeme sayfasında sessiz bir
  "Uygulamada %10 daha ucuz" satırı yayındaki mağazanın `/app?kaynak=web-shop|web-checkout`
  bağıyla; oran 0 ya da mağaza kapalıysa gizli, iOS'ta App Store yayındayken Safari akıllı
  bandı aynı işi yaptığı için gizli.

## Dükkan ve esnaf

- **Başvuru:** `/become-partner` formu `PartnerLead` / başvuru olarak düşer; yönetici
  `/admin/applications` (mobil "Başvurular") üzerinden onaylar. Onaylanmamış dükkan
  aramada çıkmaz. Açılış öncesi noktalar (`PRELAUNCH`) görünür ama rezerve edilemez.
- **Ayarlar:** çalışma saatleri, kapanış günleri, kapasite, fiyat, fotoğraflar
  (S3, `src/lib/storage/`), telefon (0 ile gösterilir, arama ülke koduyla gider).
- **Panel:** günlük hareketler, rezervasyon araması (sunucuda, tüm tarihler), kazanç
  özeti (`PartnerEarningsService`), QR afişi (`/partner/poster`, `/app?kaynak=afis-<shopId>`).
- **Misafirle iletişim:** WhatsApp tıkla-yaz bağlantısı (`src/lib/whatsapp.ts`); otomatik
  WhatsApp mesajı gönderilmez.

- **Kapıdan gelen misafir** (2026-11-25, web panel ve mobil esnaf, sahip + personel): uygulaması
  olmayan gezgine tezgahta rezervasyon açılır (ad, isteğe bağlı telefon/e-posta, valiz, alma
  saati). Rezervasyon "şimdi" başlar, normal fiyat/kapasite/saat/tatil kuralları geçerli, indirim
  yok, `source = walk_in`; hesapsızdır (`guestId` boş). Mühür kapalıysa hemen teslim alınır,
  açıksa normal teslim ekranı açılır. E-posta verildiyse onay yönetim bağıyla gider (misafir
  sonra o e-postayla hesap açınca rezervasyon bağlanır); yoksa QR ve kod ekrandan fotoğraflanır
  (misafire SMS yok). Operatör "misafir şartları kabul etti" beyanını işaretler; beyan, metin
  sürümleriyle `CREATED` olayına yazılır. Sınır: operatör başına 10/10 dk, dükkan başına 30/saat,
  aynı e-posta adresine günde 3 onay (aşılınca rezervasyon yine açılır, e-posta atlanır, QR
  ekranda). Form gönderimi başına istemci anahtarı (`idempotencyKey`) ikinci rezervasyonu önler.
  `WalkInBookingService`.
  - **E-posta kanıtlı değildir:** adresi operatör yazdı. Walk-in rezervasyonu o e-postayla açılan
    hesaba **otomatik bağlanmaz**; misafir yönetim bağını kullanır. Bağ ya da QR fotoğrafı tek
    başına teslim için yetmez: teslim ekranında (web ve mobil) misafirin adı gösterilir ve
    operatör adı karşılaştırır.
  - **Saklama (KVKK):** hesaba hiç bağlanmamış walk-in satırında ad, e-posta ve telefon teslimden
    (yoksa planlı alma saatinden) 180 gün sonra `cleanup` işiyle boşaltılır; rezervasyon kaydı
    defter için kalır. Hesap silmede hesaba bağlı rezervasyonların bu alanları da boşaltılır,
    veri dışa aktarımı bu alanları içerir. Aydınlatma Metni (`/kvkk`, `/privacy`) operatörün
    tezgahta topladığı misafir verisini (ad, isteğe bağlı telefon/e-posta, amaç: emanet ve
    teslim; süre: 180 gün) kapsamalıdır; metin hukuk onayıyla güncellenir.
- **Afiş atfı:** afiş QR'ı (`/app?kaynak=afis-<dükkan>`) 30 dakikalık imzalı çerez bırakır
  (son dokunuş); mağaza kapalıyken okutan kişi doğrudan dükkanın sayfasına iner. Uygulama
  `/shop/<id>?kaynak=afis-<id>` bağlantısıyla açıldıysa aynı pencereyle checkout'a ekler. Bu
  pencerede başlayan rezervasyon `source = poster`, `sourceShopId` afişin dükkanı (aktif, test
  ve talep testi olmayan dükkan). Başarılı web rezervasyonundan sonra çerez silinir; bir okutma
  bir rezervasyon. Mağazadan yeni kurulan uygulamaya atıf taşınmaz (ertelenmiş derin bağlantı
  native SDK ister). Afiş sayısı **güvenilmez bir göstergedir** (uygulama atfı imzasız, çerez
  kopyalanabilir): paraya (bonus, komisyon) bağlanacaksa önce sunucu tarafı tek kullanımlık
  nonce gerekir.
- **Kanal istatistiği:** yalnız sayı; bonus/komisyon yok (sahip kararı). Esnaf panelinde bu ay
  ve geçen ay "Afişinizden gelen" ve "Kapıdan gelen" (personel de görür, tutar yok); yönetici
  analitiğinde app / web / walk-in / afiş / bilinmiyor dağılımı. İptaller sayılmaz.

### Tezgahta adımlar (personel için)

1. Misafirin QR'ını okut ya da rezervasyon kodunu ara.
2. Valizi dışarıdan kontrol et; seri numaralı mührü fermuara tak ve numarayı gir.
3. Valizi yalnız personelin girdiği alana koy.
4. Teslimde QR'ı yeniden okut, mührün sağlam olduğunu misafire göster, kopar, teslim et.
5. Valiz sayısı farklıysa revizyon yap; misafir gecikiyorsa ve arıyorsa "Misafiri bekle".

## Platform ayarları

Tek kaynak: Prisma `PlatformSettings` (`id = "default"`), okuma için `getPricingRules()` (`src/lib/platform-settings.ts`) (60 saniyelik bellek önbelleği). Varsayılanlar `src/lib/pricing-rules.ts` ile şemada aynı olmak zorunda (`pricing-defaults.test.ts`); bu varsayılanlar canlı fiyatı değiştirmez, prod satırı yalnızca yönetim arayüzünden değişir.

### Yönetim

Web: **`/admin/platform-settings`**. Mobil: yönetici sekmesi → "Platform ayarları" (`/api/mobile/admin/platform-settings`; aynı servis, `src/services/PlatformSettingsService.ts`). Riskli alanlar (komisyon, mühür zorunluluğu vb.) onay ifadesi ister (`src/lib/admin-risky-settings.ts`).

| Alan | Varsayılan | Ne yapar |
|---|---|---|
| `defaultPricePerDay` | 250 | Dükkan fiyatı yoksa valiz başına günlük TL |
| `bagMultiplierS` / `M` / `Xl` | 0.8 / 1.0 / 1.5 | Boy çarpanı (prod satırında üçü de 1.0: tek fiyat iş kararı) |
| `maxStayDays`, `maxBagsPerSlot`, `defaultShopCapacity` | 30, 50, 10 | Limitler |
| `insuranceFeeTry` | 0 | Güvence bedeli (misafirden ayrıca alınmaz) |
| `earlyRefundRatio`, `cancelFixedFeeTry` | 1.0, 0 | İptal kesintisi / iade oranı |
| `latePickupFeeTry`, `latePickupGraceMin` | 0, 15 | Geç teslim alma ücreti ve toleransı |
| `checkInGraceMin` | 30 | Kapanıştan sonra check-in toleransı |
| `requireSealsOnCheckIn` | false | Check-in'de mühür kaydı zorunlu mu |
| `platformCommissionRate` | 0.20 | Platform payı; tahsilat yokken etkin oran 0 (`docs/PAYMENTS.md`) |
| `platformHolidayDates` | boş | Rezervasyona kapalı günler (`YYYY-MM-DD` JSON); `BOOKING_CALENDAR_TIMEZONE`, varsayılan `Europe/Istanbul` |
| `minAppVersion`, `latestAppVersion` | boş | Mobil zorunlu / önerilen güncelleme eşiği (semver) |
| `iosAppStoreLive`, `androidPlayLive` | false | Mağaza yayın bayrakları (aşağıda) |
| `appBookingDiscountPct` | 10 | Mobil uygulama rezervasyonu indirimi (yüzde, 0..50; 0 = kapalı). § Uygulama indirimi |

### Önbellek ve denetim

`updatePlatformSettingsAction` kayıttan sonra `invalidatePricingRulesCache()` çağırır; aynı süreçte yeni kurallar hemen, diğer okuyucularda en geç 60 saniyede geçerlidir.

`PlatformSettings.updatedAt` son değişiklik zamanını tutar ve ekranda gösterilir; her değişiklik `AuditLog`'a da yazılır (web `/admin/audit-log`, mobil "Denetim kaydı").

### Mağaza yayın bayrakları (`iosAppStoreLive`, `androidPlayLive`)

Varsayılan ikisi de kapalı; kapalıyken site uygulama tanıtımı göstermez. Mağaza yayına
girince web `/admin/platform-settings` ya da mobil yönetici "Platform ayarları"ndan açılır.
Android bayrağını kapalı test sürerken açmayın.

| Açılınca | Nerede |
|---|---|
| Safari akıllı bandı (`apple-itunes-app`, dükkan sayfasında `app-argument`) | yalnız iOS |
| Ana sayfa ve altbilgi rozetleri (`/app?kaynak=web-home` / `web-footer`) | yayındaki mağaza |
| Misafir onay e-postasında "Uygulamayı indir" satırı (`kaynak=email-onay`) | yayındaki mağaza |
| `/app` o platformu mağazaya 302 ile gönderir; diğerleri `/<dil>/app` açılış sayfasına | platforma göre |

Esnaf QR afişi (`/partner/poster`) bayraktan bağımsız çalışır: QR `/app?kaynak=afis-<shopId>`
gösterir, mağaza kapalıyken açılış sayfasına düşer. `/app` isabetleri (kaynak, platform,
sonuç; IP ve UA tutulmaz) `AppLinkHit` tablosunda, son 30 gün özeti ayar sayfasının altında.

Bayrak değişince kök layout yeniden doğrulanır (`revalidatePath`); build veritabanısız
olduğu için statik sayfalar ayrıca 5 dakikalık ISR ile (`[locale]/layout.tsx`) gerçek bayrağa
döner. Bayrak okuması 60 sn önbellekli; altbilgi bayrağı istemcide `/api/app-stores`ten okur.

Kaynak etiketi yalnızca `web-*`, `email-*`, `afis-<shopId>` ve kısa bir kampanya listesi
(instagram, facebook, tiktok, google, whatsapp, qr, airbnb) olabilir; gerisi `other`.
İsabetler 90 gün tutulur (`cleanup` işi siler). Sayımlar üst sınırdır: e-posta
sağlayıcılarının bağlantı tarayıcıları (Outlook Safe Links vb.) bazen tarayıcı UA'sıyla
gelir ve bot sayılmaz, bu yüzden `email-onay` gerçek tıklamadan biraz yüksek okunabilir.

## Mühür envanteri

Mühür durumları `STOCK → ASSIGNED → IN_USE → RETURNED` (bozuksa `FAULTY`). Esnaf
panelden mühür talep eder (`SealRequest`), yönetici `/admin/seals`'ten gönderir.
Haftalık `seal-forecast` işi stok ihtiyacını tahmin eder; `SealIntegrityService`
envanter tutarlılığını salt okunur denetler, onarım `scripts/repair-seal-ownership.sh`
ile bilinçli yapılır. Otomatik kargo tetikleme yoktur.

## Bildirimler

| Kanal | Durum | Kullanım |
|---|---|---|
| E-posta (Resend) | açık | doğrulama, şifre sıfırlama, rezervasyon onayı (yayındaki mağazaya "uygulamayı indir" satırı), hatırlatmalar, esnafa yeni rezervasyon, yöneticiye uyarılar |
| Mobil push (Expo / FCM) | açık | misafir ve esnaf olayları, duyurular |
| Web push (VAPID) | açık | esnafa yeni rezervasyon |
| SMS (Netgsm) | **kapalı** | `sendNetgsmRestSms` bilerek `sms_disabled` döner |
| WhatsApp | yalnızca bağlantı | esnaf ↔ misafir sohbeti insan başlatır |

Duyurular (`Broadcast`: esnaflar, misafirler, herkes) yalnızca yöneticiden, yalnızca mobil
cihazlara gider; biri sürerken yenisi reddedilir. E-posta metinleri 6 dili taşımak
zorunda (`notification-locale-coverage`).

## Destek

- Web'de Crisp canlı sohbeti (ilk tıklamada yüklenir), iletişim formu
  (`ContactMessage`); yönetici `/admin/messages` ve mobil "Mesajlar"dan yanıtlar.
- İtirazlar `/admin/disputes` ve mobil "İtirazlar"da.
- Yazılı bir SLA taahhüdü yoktur.

## Hukuki çerçeve

Bağlayıcı metinler sitedeki sayfalardır, bu belge değil: `/terms`, `/privacy`, `/kvkk`,
`/cancellation`, `/insurance`, `/account-deletion`. Misafirin hangi metin sürümünü kabul
ettiği `LegalAcceptance`'ta tutulur. Hesap silme anonimleştirmedir
(`AccountPrivacyService`). Yasaklı eşyalar ve güvence istisnaları Kullanım Şartları'nda.
İlişki Türk Borçlar Kanunu'ndaki saklama sözleşmesine (TBK 561 vd.) dayanır.
