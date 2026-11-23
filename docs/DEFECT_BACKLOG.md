# BagajPark — Kanıtlı Hata Backlog'u

> Bu doküman **iş kuyruğudur**: her madde ya bir dosya:satır ya da çalıştırılmış bir
> sorgu/ölçümle kanıtlanmıştır. Doğrulanmamış hiçbir şey kesin bulgu olarak yazılmaz —
> öyle şeyler "F. Yeniden ölçülmeli" başlığındadır.
>
> `docs/PRODUCTION_BACKLOG.md` stratejik/uyumluluk **dilek listesidir**, bu dosya ise
> kanıtlı iş listesi. İki katman: en üstteki **BEKLEYEN KARARLAR** açık kalan her şeyin
> tek listesidir (yerinde güncellenir); altı tarihli ve append-only kayıttır.
>
> **Geçmiş:** 2026-08-21 → 2026-09-12 arasındaki tarihli kayıtlar (P0-0…P0-8,
> P1-1…P1-26, P2-1…P2-11, D1…D10, B7, MOBIL-1…5 ve 2026-08-29 sapma taramasının
> "madde 1…N"leri) `docs/archive/2026-11-23-denetim-gecmisi/DEFECT_BACKLOG_2026-08-21_2026-09-12.md`
> dosyasındadır. Koddaki "DEFECT_BACKLOG P1-6 / D5 / madde 6" atıflarının tam metni
> oradadır; kimlikler değişmedi. Aynı klasörde 2026-08-31 UX denetimi
> (`UX_AUDIT_2026-08-31.md`) ve 2026-08-23 statik kod taraması (`KOD_TARAMA_2026-08-23.md`)
> durur; ikisinin de açık kalan maddeleri aşağıya taşındı.

## BEKLEYEN KARARLAR — 2026-11-23 itibarıyla

> Bir karar verildiğinde ilgili satırı buradan sil, kararı tarihli bir kayıt olarak
> aşağıya yaz. Sohbette söylenmiş olması saymaz.

### A. Hukuk danışmanı gerektirenler

| # | Konu | Neden bekliyor |
|---|---|---|
| A1 | **Esnaf sözleşme paketi** — ortaklık sözleşmesi, veri işleyen sözleşmesi, emanet/sorumluluk şartları | Esnaf, misafirle **aynı iki tüketici belgesini** kabul ederek kaydoluyor (`terms`, `privacy`). Esnafa özel belge yok; oysa esnaf misafirin adını/telefonunu/e-postasını görüyor ve fiziksel emanet alıyor. |
| A2 | **Sorumluluk maddesi** | `Terms.a2` tek cümle: *"Maksimum 10.000 TL sigorta."* SSS "kapsam, istisnalar ve başvuru Şartlar'da" diyor; işaret ettiği yer boş. |
| A3 | **"Sigorta" terimi** | Metinlerin bir kısmı *"sigortalıdır"* diyor, `Guest.trustInsuranceBody` ve `FAQ.a1` *"bağımsız perakende poliçe değildir"* diyor. Hangisinin doğru olduğu bir sözleşme olgusu (anlaşmalı sigortacı var mı?). TR'de 5684 sayılı Kanun / SEDDK. |
| A4 | **Terk edilmiş valiz prosedürü** | Kaç gün sonra ne olur, hangi bildirimle, nasıl tasfiye? Misafir hatırlatması artık en fazla 7 kez gidiyor (2026-11-23 kaydı); sonrası tanımsız. |

### B. Ürün sahibi kararı — para ve politika

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

### C. Sende — bu depoda yapılamayan adımlar

| # | Konu | Ne gerekiyor |
|---|---|---|
| C4 | **Mobil check-in fotoğrafı** | Flutter uygulaması 2026-10-18'de kaldırıldı; Expo uygulamasında check-in fotoğrafı yok ve mobil check-in ucu fotoğraf kabul etmiyor. İş iki taşıyıcıda da yapılmalı (sunucu: `SealService.uploadSealPhoto`'yu mobil uçtan çağıran yol; Expo: çekim ekranı). B3'e bağlı. |

C1 (S3 ortam değişkenleri), C2 (VAPID) ve C5 (FCM servis hesabı) kapandı — bkz.
2026-11-23 kaydı.

### D. Sen seçersen yapılabilir — teknik iş, karar küçük

| # | Konu | Kaynak |
|---|---|---|
| D2 | **Esnafa uyuşmazlık yüzeyi** — haberdar et + kendi kanıtını göster | B6 ile birlikte |
| D10 | **Fiyat güven sınırı çağıranda** — `createInitialBooking` (`src/services/booking/create.ts`) `totalPrice`/`unitPrice`'ı girdi olarak alıyor, `computeAuthoritativeCheckoutTotals`'ı kendisi çağırmıyor. Bugün istismar yok (web action ve mobil intent ucu önceden hesaplıyor), ama üçüncü bir çağıran bunu unutursa yakalanmaz. | `KOD_TARAMA_2026-08-23.md` § 8 (arşiv) |

D8 (yazdırılabilir vitrin afişi / QR) kapandı — bkz. 2026-11-23 kaydı.

### E. UX — 2026-08-31 ölçümünden açık kalan, yeniden ölçülmeli

| # | Konu | Ölçülen (2026-08-31) |
|---|---|---|
| UX-12 | Çerez paneli mobilde ana eylemi örtüyor | Ana sayfada arama kutusunun alt yarısı, arama sayfasında alt panelin tamamı. Öneri: mobilde tek satır + iki düğme. |
| UX-14/15 | Mobil checkout'ta yapışkan özet çubuğu ekranın %31'i; seçili M/L satırı ilk açılışta çubuğun arkasında, görünen satır "0", özet "1 Valiz" | Çözüm alt menüyü gizlemek değil; özet çubuğu ya da üstteki başlık/adım göstergesi daralmalı. |

Kanıt ve ölçüm yöntemi: `docs/archive/2026-11-23-denetim-gecmisi/UX_AUDIT_2026-08-31.md`.
Regresyon taraması `node scripts/ux-sweep.mjs` (bkz. `scripts/README.md`).

### F. Yeniden ölçülmeli — 2026-08-22 prod ölçümünden kalan veri uçları

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

## 2026-11-23 — belge denetimi: kapanan bekleyen maddeler

Bekleyen listesi koda ve git geçmişine karşı yeniden doğrulandı:

- **C1 S3 kapandı:** medya bucket'ı ve rol izni Terraform'da (`8aa3d6fa`, 2026-10-18);
  dükkan fotoğrafı yükleme web, mobil esnaf ve mobil admin'de çalışıyor (#194).
- **C2 VAPID kapandı:** web push anahtarları imaja gömülüyor (`0e53b0dc`, 2026-09-23).
- **C5 FCM kapandı:** `FIREBASE_SERVICE_ACCOUNT_JSON` SSM'de (2026-10-18). iOS
  bildirimleri FCM'e değil Expo push servisine gidiyor (`src/lib/expo-push.ts`);
  `NotificationService.deliverMobilePush` token biçimine göre ayırıyor.
- **C4 yeniden yazıldı:** "Flutter ekranı eksik, sunucu iki taşıyıcıyı destekliyor"
  artık doğru değil — Flutter yok, mobil check-in ucu da fotoğraf almıyor.
- **D8 kapandı:** `/[locale]/partner/poster` yazdırılabilir A4 afiş; QR
  `/app?kaynak=afis-<shopId>`'e gider (`cf758a3a`, #206).
- **UX denetimi** (#17–18 kontrast `31a790a2`, #19 PWA dili `ba118678`, #42
  çevrimdışı sayfa `b8ac8e57`, #48 web push `47e0d245`) kapanmıştı; açık kalan #12
  ve #14–15 E bölümüne alındı.
- **Kod taraması 2026-08-23:** B10 (referans linki) `7fe82aed` ile kapanmıştı; B7
  D10 olarak taşındı.
- Eski P1-21 ve P0-3 B'ye, veri tarafı açık kalan eski P maddeleri F'ye özetlendi;
  tam metinleri arşivde.

## 2026-11-23 — misafire geç teslim hatırlatması yeniden yazıldı (D1'in devamı)

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

