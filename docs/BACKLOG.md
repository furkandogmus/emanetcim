# BagajPark — iş listesi

Tek iş listesi: açık kararlar, kanıtlı hatalar, açık teknik işler, sürüm öncesi kontrol.
Her hata maddesi bir dosya:satır ya da çalıştırılmış bir sorguyla kanıtlanmıştır;
doğrulanmamış şey kesin bulgu yazılmaz, "Yeniden ölçülmeli"ye girer. Ürünün bugünkü
kuralları `docs/URUN_VE_IS_KURALLARI.md`'de, ödeme `docs/PAYMENTS.md`'de.

İki katman: üstteki bölümler yerinde güncellenir (karar verilen ya da kapanan satır
silinir); en alttaki "Tarihli kayıt" yalnızca eklenir. Koddaki "DEFECT_BACKLOG P1-6 /
D5 / madde 6" gibi eski atıfların tam metni git geçmişinde (`docs/DEFECT_BACKLOG.md`,
2026-11-23 öncesi). Eski `DEFECT_BACKLOG.md`, `PRODUCTION_BACKLOG.md` ve
`LAUNCH_CHECKLIST.md` 2026-11-23'te bu belgede birleşti.

## Son durum — 2026-11-23

- Site `bagajpark.com`'da yayında, ödemesiz: sağlayıcı `manual`, misafir dükkanda öder.
  Ödemeyi açan/kapatan tek anahtar `PAYMENT_PROVIDER`.
- Mobil: iOS 0.3.4 App Review'da, Android kapalı test izinde (`mobile-expo/*_YAYIN.md`).
- Sürüyor (birleşmedi): ortaklık (affiliate) programı (#207), anlık dükkan slotları ve
  esnaf adayı dönüşümü (#208).

## 1. Bekleyen kararlar

> Bir karar verildiğinde satırı buradan sil, kararı "Tarihli kayıt"a yaz. Sohbette
> söylenmiş olması saymaz.

### 1.A. Hukuk danışmanı gerektirenler

| # | Konu | Neden bekliyor |
|---|---|---|
| A1 | **Esnaf sözleşme paketi** — ortaklık sözleşmesi, veri işleyen sözleşmesi, emanet/sorumluluk şartları | Esnaf, misafirle **aynı iki tüketici belgesini** kabul ederek kaydoluyor (`terms`, `privacy`). Esnafa özel belge yok; oysa esnaf misafirin adını/telefonunu/e-postasını görüyor ve fiziksel emanet alıyor. |
| A2 | **Sorumluluk maddesi** | `Terms.a2` tek cümle: *"Maksimum 10.000 TL sigorta."* SSS "kapsam, istisnalar ve başvuru Şartlar'da" diyor; işaret ettiği yer boş. |
| A3 | **"Sigorta" terimi** | Metinlerin bir kısmı *"sigortalıdır"* diyor, `Guest.trustInsuranceBody` ve `FAQ.a1` *"bağımsız perakende poliçe değildir"* diyor. Hangisinin doğru olduğu bir sözleşme olgusu (anlaşmalı sigortacı var mı?). TR'de 5684 sayılı Kanun / SEDDK. |
| A4 | **Terk edilmiş valiz prosedürü** | Kaç gün sonra ne olur, hangi bildirimle, nasıl tasfiye? Misafir hatırlatması artık en fazla 7 kez gidiyor (2026-11-23 kaydı); sonrası tanımsız. |

### 1.B. Ürün sahibi kararı — para ve politika

| # | Konu | Seçenekler / durum |
|---|---|---|
| B1 | **İndirim politikası** — kuponun bedelini kim karşılar? | Bugün **tamamen esnaf** (hakediş indirilmiş `totalPrice` üzerinden). Esnaf / platform / paylaşımlı. `couponDiscountAmount` kayıtlı, yani ölçülebilir. |
| B2 | **İptal ücreti** — `cancelFixedFeeTry` | Ayar yönetim panelinde var (web ve 2026-11-22'den beri mobil admin), ama onu okuyan iş kuralı yok; iptal her zaman tam iade. Ya PSP sonrası uygulanır ya ayar kaldırılır. |
| B3 | **"Fotoğraf" ibaresi** | Mühür kanıt fotoğrafı yalnızca **web** esnaf check-in'inde çekiliyor (`SealService.uploadSealPhoto`). Mobil check-in ucu (`/api/mobile/bookings/[id]/check-in`) fotoğraf almıyor, Expo uygulamasında çekim ekranı yok. `FAQ.a1` "teslimde mühürleme ve fotoğraf alınır" diyor. Ya ibare yumuşatılır ya mobil tamamlanır (bkz. C4). |
| B4 | **`FAQ.q5` olmayan bir ödeme satırını anlatıyor** | *"Ödemedeki güvence satırı neyi kapsar?"* — `insuranceFeeTry` varsayılanı 0 (`src/lib/pricing-rules.ts`). Ücret mi konacak, metin mi kalkacak? |
| B5 | **`AnalyticsEvent.userId` anonimleştirmeden sağ çıkıyor** | Sil / boşalt / bırak (`account-erasure-coverage.test.ts` bunu "gözden geçirilmeli" diye işaretliyor). |
| B6 | **Esnafa şikâyet bildirimi** | Hakkında hasar/hırsızlık şikâyeti açılan esnaf haberdar edilmiyor, görüşünü bildiremiyor. Süreç tercihi. |
| B8 | **Açık uyuşmazlık hakedişi bekletmiyor** | `PartnerEarningsService` uyuşmazlığa bakmıyor. Dükkanda tahsilat modelinde etkisiz; PSP bağlandığı gün kritik. Bekletilsin mi, hangi durumda serbest kalır? |
| B9 | **Valiz boyutu fiyatı** (eski P0-3) | Kod varsayılanı 0.8/1.0/1.5; canlı `PlatformSettings` satırı 2026-08-22'de 1.0/1.0/1.0 idi. Çarpanlar ayrıştırılsın mı, yoksa tekdüze fiyat bilinçli karar mı? Canlı değer yeniden okunmalı (F). |
| B10 | **Gecikme ücreti tahsil edilmiyor** (eski P1-21) | `latePickupFeeTry` hesaplanıp `Booking.lateFeeApplied`'a yazılıyor, tahsilat yok. Sözleşme "otomatik tahsil edilir" diyor; metin gerçeğe çekilmeli ya da tahsilat kalemi `PaymentService`'e eklenmeli. |

### 1.C. Sende — bu depoda yapılamayan adımlar

| # | Konu | Ne gerekiyor |
|---|---|---|
| C4 | **Mobil check-in fotoğrafı** | Flutter uygulaması 2026-10-18'de kaldırıldı; Expo uygulamasında check-in fotoğrafı yok ve mobil check-in ucu fotoğraf kabul etmiyor. İş iki taşıyıcıda da yapılmalı (sunucu: `SealService.uploadSealPhoto`'yu mobil uçtan çağıran yol; Expo: çekim ekranı). B3'e bağlı. |

### 1.D. Sen seçersen yapılabilir — teknik iş, karar küçük

| # | Konu | Kaynak |
|---|---|---|
| D2 | **Esnafa uyuşmazlık yüzeyi** — haberdar et + kendi kanıtını göster | B6 ile birlikte |
| D10 | **Fiyat güven sınırı çağıranda** — `createInitialBooking` (`src/services/booking/create.ts`) `totalPrice`/`unitPrice`'ı girdi olarak alıyor, `computeAuthoritativeCheckoutTotals`'ı kendisi çağırmıyor. Bugün istismar yok (web action ve mobil intent ucu önceden hesaplıyor), ama üçüncü bir çağıran bunu unutursa yakalanmaz. | 2026-08-23 kod taraması § 8 |

### 1.E. UX — 2026-08-31 ölçümünden açık kalan, yeniden ölçülmeli

| # | Konu | Ölçülen (2026-08-31) |
|---|---|---|
| UX-12 | Çerez paneli mobilde ana eylemi örtüyor | Ana sayfada arama kutusunun alt yarısı, arama sayfasında alt panelin tamamı. Öneri: mobilde tek satır + iki düğme. |
| UX-14/15 | Mobil checkout'ta yapışkan özet çubuğu ekranın %31'i; seçili M/L satırı ilk açılışta çubuğun arkasında, görünen satır "0", özet "1 Valiz" | Çözüm alt menüyü gizlemek değil; özet çubuğu ya da üstteki başlık/adım göstergesi daralmalı. |

Ölçüm yöntemi 2026-08-31 UX denetimindeydi (`docs/UX_AUDIT.md`, git geçmişinde).
Regresyon taraması `node scripts/ux-sweep.mjs` (bkz. `scripts/README.md`).

### 1.F. Yeniden ölçülmeli — 2026-08-22 prod ölçümünden kalan veri uçları

Kod tarafı kapandı, veri tarafı o günden beri yeniden sorgulanmadı. Prod sorgusuyla
doğrulanıp ya kapatılmalı ya B/C'ye taşınmalı:

| Eski kimlik | Kalan |
|---|---|
| P0-3 | Canlı `PlatformSettings` çarpanları (B9) |
| P0-4 / P1-20 / P1-25 | Geçmiş rezervasyonlardaki 150 TRY sigorta satırı; "güvence" rozeti ve /insurance vaadi (A2–A3, B4) |
| P1-2 | `ReservationSlot` geçmiş rezervasyonlar için backfill |
| P1-3 | E-postası olmayan esnaf hesapları |
| P1-5 | Prod defterindeki script rezervasyonları ve demo hesap parolaları |
| P1-7 | Dükkana bağlı olmayan `ASSIGNED` mühürler (`scripts/repair-seal-ownership.sh` çalıştırıldı mı?) |
| P1-18 | Gelen kutusundaki geçmiş spam için `classify-inbox` geriye dönük koşusu |
| P1-22 / P1-23 | `CHECKED_OUT`'a giden yolun sahada kullanımı; `requireSealsOnCheckIn` ayarının canlı değeri |

## 2. Açık teknik işler

**Online ödemeyi açma** (2026-06-10 kararı, kriterler açık): 50 aktif nokta; 100 sorunsuz
uçtan uca rezervasyon; esnaf onboarding'inde bilinen tıkanma kalmaması; şirket kuruluşu +
PSP sözleşmesi, adaptör ve webhook ucu (`docs/PAYMENTS.md`). Beta süresince komisyon
alınmaz (`platformCommissionRate` 0.20, etkin oran 0). Ödeme açılmadan önce KDV kararı:
komisyon faturası KDV dahil mi, `PaymentSplit`'te oran enstantanesi tutulacak mı.

| Alan | Açık iş |
|---|---|
| İzleme | Dışarıdan sentetik izleme ve SSL süre uyarısı (`/api/health/live`). Bugün dış izleme yok: 2026-10-25..11-23 cron kesintisini kimse fark etmedi |
| Güvenlik | CSP'yi Report-Only'den zorunluya geçirmek; sır rotasyonunu takvime bağlamak (şu an elle); Dependabot/Renovate ve SBOM; DMARC politikası |
| Veri | PITR ve takvimli geri yükleme tatbikatı (yedek 6 saatte bir S3'e, `ops/README.md`); anonim staging dump |
| Hukuk/içerik | KVKK / gizlilik / şartlarda şirket bilgileri (şirket kurulunca); metin değişince yeniden onay akışı (`LegalAcceptance` kaydı var) |
| SEO/büyüme | Bing Webmaster Tools; partner noktaları için Google Business Profile; ana sayfa şehir kartlarındaki Unsplash hotlink görselleri yerel optimize görsele |
| Yönetim | Platform ayarında tek tıkla geri alma (her değişiklik zaten `AuditLog`'da); bildirimde kanal başına opt-out |
| Kalite | CI'da coverage eşiği; yük testinin (`tests/stress/`) düzenli koşumu; yüklenen görsellerde virüs taraması |

Ürün fikirleri (karar verilmedi): güvenilirlik rozetleri (`response-times` işi veriyi
hesaplıyor), bildirim tercih merkezi ve esnaf "sessiz saat"i, toplu fiyat/kapasite
düzenleme, çok para birimi gösterimi, OTA/otel kanalı (API anahtarı + imzalı giden
webhook), sigorta ortağı poliçe referansı.

## 3. Sürüm öncesi kontrol listesi (her büyük sürümde)

**Akışlar** (Playwright `tests/e2e/` bir kısmını kapsar — `booking-lifecycle`, `use-cases`,
`admin-platform-settings`; kalanı elle):

- Misafir kayıt, e-posta doğrulama, giriş (e-posta, Google, Apple)
- Arama → dükkan → rezervasyon → onay e-postası
- Esnaf check-in (QR, mühür), valiz revizyonu, check-out; geç bırakma ve "Misafiri bekle"
- Misafir rezervasyon detayı, iptal, itiraz, yorum
- Yönetici: başvuru onayı, iptal, itiraz çözümü, platform ayarı değişikliği

**Veri bütünlüğü:** durum geçişleri `APPROVED → PAID → CHECKED_IN → CHECKED_OUT`, iptalde
`CANCELLED`, her geçiş `BookingEvent`'te; çakışan pencerelerde kapasite aşılmıyor, iptalde
slot ve kupon geri dönüyor; `consistency-check` işi temiz.

**Altyapı:** `/api/health/live` 200; `web`, `nginx`, `postgres`, `redis` sağlıklı;
zamanlanmış işler yeşil (`/admin/jobs`, `scripts/README.md`); CI kırmızıysa deploy olmaz
(`docs/GELISTIRME.md` § CI/CD), geri dönüş önceki `sha-<sha>` imajıyla.

**Mobil sürüm ek olarak:** `npm run verify` (mobile-expo), OTA runtime uyumu ve mağaza
bayrakları (`docs/URUN_VE_IS_KURALLARI.md` § Platform ayarları); `mobile-expo/IOS_YAYIN.md`,
`mobile-expo/PLAY_YAYIN.md`.

## Tarihli kayıt

### 2026-11-23 — belge denetimi

Bekleyen listesi koda ve git geçmişine karşı yeniden doğrulandı. Kapananlar: C1 S3
(`8aa3d6fa`, #194), C2 VAPID (`0e53b0dc`), C5 FCM (SSM'de; iOS Expo push), D8 QR afişi
(`cf758a3a`, #206); UX denetiminden #17–18, #19, #42, #48. C4 Expo'ya göre yeniden yazıldı.
Kod taramasının B7'si D10 oldu. Eski P0-3 ve P1-21 B9/B10'a, veri tarafı açık eski P
maddeleri 1.F'ye özetlendi.

### 2026-11-23 — misafire geç teslim hatırlatması yeniden yazıldı (D1'in devamı)

**Bulgu:** D1'in tekrar kontrolü `NotificationLog.subject` öneki
(`"BagajPark: Valizinizi almayı unuttunuz"`) ile sayıyordu; bu önek yalnızca TÜRKÇE
konuyla eşleşiyor. `en/de/fr/ja/fa` misafirde sayaç hep 0 kalıyor, yani valizi
dükkanda kalan yabancı misafire `booking-reminders` her 15 dakikada bir, süresiz
e-posta atıyordu. Push yalnızca e-postası olan misafire gidiyordu.

**Karar (ürün sahibi):** +30 dk, +24 sa, sonra en fazla 24 saatte bir, toplam en fazla 7.
Ücret ve terk edilmiş eşya politikası kapsam dışı; metin ücretten söz etmez.

**Uygulama:** `OverdueGuestReminderService` (takvim `src/lib/overdue-guest-reminder.ts`).
Her slot göndermeden ÖNCE `BookingEvent` (`OVERDUE_GUEST_REMINDER`, `metadata.slot`)
olarak rezervasyon başına `pg_advisory_xact_lock` altında sahipleniliyor; kilit içinde
durum yeniden okunuyor (`CHECKED_IN` değilse gönderilmez). Push ve e-posta birbirinden
bağımsız. Yeni cron yok: aynı `booking-reminders` işi (`7,22,37,52 * * * *`) çağırıyor.
Migrasyon yok. Esnaf tarafı değişmedi.

