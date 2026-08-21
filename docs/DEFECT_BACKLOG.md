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

## Son durum — 2026-08-22

| Alan | Denetlendi mi | Sonuç |
|---|---|---|
| Veri bütünlüğü + iş kuralları | ✅ tamamlandı | **5 P0, 11 P1, 7 P2** |
| Misafir rezervasyon akışı (UI) | ❌ yarım kaldı | ajan harcama limitinde öldü |
| Misafir diğer sayfalar + auth | ❌ yarım kaldı | ajan harcama limitinde öldü |
| Partner paneli | ❌ yarım kaldı | ajan harcama limitinde öldü |
| Admin paneli | ❌ yarım kaldı | ajan harcama limitinde öldü |
| Backend güvenlik/doğruluk | ❌ yarım kaldı | ajan harcama limitinde öldü |
| i18n (14 dil) | ❌ yarım kaldı | ajan harcama limitinde öldü |

Yani aşağıdaki liste **eksiksiz değil** — yalnızca bir yüzeyin tam denetimini ve
21-22 Ağustos'ta elle bulunan hataları içeriyor. Kalan 6 yüzey hâlâ taranmayı bekliyor.

### En acil üç şey

1. **Hiçbir ödeme sağlayıcısı entegre değil**, ama `PaymentLog.status` varsayılanı
   `SUCCESS` ve kamuya açık sayfalar kartla tahsilat/iade vaat ediyor. Aşağıdaki
   maddelerin çoğunun kök nedeni bu (P0-0).
2. **Slot üretimi 2026-07-14'te durdu ve onu çalıştıran hiçbir zamanlanmış iş yok.**
   Saatlik ürün fiilen erişilemez durumda, per-slot kapasite kontrolü devre dışı.
3. **`/api/internal/generate-slots` kimlik doğrulaması olmadan herkese açık** ve
   sınırsız veritabanı yazması tetikliyor.

---

## P0 — Para, güven veya erişilebilirlik doğrudan bozuk

### [P0-0] Hiçbir ödeme sağlayıcısı entegre değil, ama sistem para almış gibi davranıyor
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
- **Çözüm**: iki aşamalı. **Kısa vade (lansmandan önce, kod değil metin):** kartla
  ödeme/iade vaat eden tüm metinleri gerçek sürece çek. **Orta vade:** şahıs şirketi
  kurulduktan sonra sağlayıcıyı entegre et; `PaymentStatus` varsayılanı `SUCCESS`
  olmaktan çıkıp `PENDING` olmalı, aksi halde entegrasyondan sonra da sahte başarılı
  kayıtlar üretilmeye devam eder.

### [P0-1] Slot üretimi 37 gündür durdu; per-slot kapasite fiilen devre dışı
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
- **Çözüm**: *operasyonel* — `fillMissingSlots()` için günlük zamanlanmış iş.
  *Kod* — slot→legacy düşüşü sessiz olmasın, loglansın/metrik olsun.

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

### [P0-3] Valiz boyutu fiyat farkı canlıda ölü: S/M/XL üçü de ₺50
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
- **Çözüm**: *veri* — `/admin/platform-settings` üzerinden canlı satırı düzelt.
  Gösterim ve tahsilat birbiriyle tutarlı (ikisi de aynı kuralı kullanıyor), sorun
  ikisinin de ayrım yapmaması. Tekdüze fiyat bilinçliyse *kod* — üç özdeş fiyatı
  göstermeyi bırak.

### [P0-4] Canlı fiyat yapılandırması geçmiş tahsilatların hiçbirini üretemiyor; müşterilerin ödediği sigorta şimdi sıfır
- **Nerede**: `Booking.insuranceFee`; `PlatformSettings.insuranceFeeTry`;
  `src/lib/booking-server-price.ts:68`
- **Kanıt**: 19 rezervasyonun tamamı `insuranceFee = 150.00` taşıyor, canlı ayar
  `0.00`. Örnek: `1/1/1` valiz → kayıtlı toplam 440.00, bugünkü kurallarla yeniden
  hesap 150.00. Yeni bir rezervasyon **hiç** sigorta satırı almıyor — ama dükkan
  detayı hâlâ "Sigortalı Emanet" rozeti gösteriyor ve sözleşme 2.3 sigorta
  kapsamından bahsediyor.
- **Neden önemli**: platform sigortalı emanet pazarlıyor ve geçmişte her rezervasyonda
  bunun için 150 TRY almış; şimdi hiçbir şey almıyor ama iddiayı sürdürüyor.
- **Çözüm**: *karar + veri* — `insuranceFeeTry`'ı belirle ya da sigorta iddiasını
  kaldır. *Kod* — rezervasyonun yanına kural sürümünü yaz ki geçmiş tahsilatlar
  yeniden üretilebilir kalsın.

### [P0-5] Geç teslim alma canlıda ücretsiz; gecikme ücreti iptal ücreti alanını ödünç alıyor
- **Nerede**: `src/services/BookingService.ts:536-552`;
  `PlatformSettings.cancelFixedFeeTry`; `(guest)/terms/page.tsx:65,74,100`
- **Kanıt**: `const lateFeeTry = lateMs > graceMs ? pricingRules.cancelFixedFeeTry : 0;`
  — gecikme ücreti *iptal* ücretini kullanıyor. Canlı `cancelFixedFeeTry = 0.00`,
  yani her zaman 0. Sıfır olmasa bile yalnızca kaydediliyor, tahsilat "ayrı süreç"
  olarak bırakılmış. Sözleşme üç ayrı yerde tersini vaat ediyor (4.4, 5.3, 8.3:
  "otomatik olarak tahsil edilir").
- **Neden önemli**: süreyi aşan müşterinin maliyetini partner üstleniyor.
- **Çözüm**: *kod* — gecikmeye kendi ayarını ver (`latePickupFeeTry`), tahsilata bağla;
  o zamana kadar *metin* — sözleşmeyi gerçeğe çek.

---

## P1 — Gerçek tutarsızlık, yakında ısıracak

### [P1-1] `/api/internal/generate-slots` kimliksiz ve sınırsız yazma tetikliyor
- **Nerede**: `src/app/api/internal/generate-slots/route.ts:4-7`
- **Kanıt** (dosyayı kendim okudum, teyitli — handler'ın tamamı bu):
  ```ts
  export async function GET() {
    const count = await fillMissingSlots();
    return NextResponse.json({ ok: true, slotsGenerated: count });
  }
  ```
  Auth yok, gizli başlık yok, rate limit yok. `fillMissingSlots` her aktif dükkan için
  gün başına 30 dakikalık slot upsert ediyor; son tam çalışma 3.696 satır üretmiş.
  Yol adının `/api/internal/` olması hiçbir şeyi zorlamıyor.
- **Neden önemli**: isimsiz herhangi biri binlerce DB yazması tetikleyebilir.
- **Çözüm**: *kod* — paylaşılan gizli başlık/cron imzası + rate limit. P0-1 için
  eklenecek zamanlanmış işle birlikte yapılmalı.

### [P1-2] `ReservationSlot` tamamen boş — 19 rezervasyona karşı 0 satır
- **Nerede**: `ReservationSlot`; `src/services/BookingService.ts:130,246-256`
- **Kanıt**: `SELECT count(*) FROM "ReservationSlot"` → **0**.
- **Neden önemli**: müsaitlik motorunun okuduğu tablo hiç dolmamış; slot üretimi geri
  açılırsa mevcut rezervasyonlar görünmez olacağı için `reserved` sıfırdan başlar.
- **Çözüm**: *kod* — slot yolunu tek yol yap ya da legacy yol da `ReservationSlot`
  yazsın. Slot motoru geri açılmadan önce *veri backfill'i* gerekiyor.

### [P1-3] 3 PARTNER hesabının 2'sinin e-postası yok; onay maili ve doğrulama sessizce atlanıyor
- **Nerede**: `User.email` (`String? @unique`); `src/services/ShopService.ts:375-404`
- **Kanıt** (bu sorguyu kendim de gördüm): `PARTNER 3 | email IS NULL 2`. İkisinin de
  telefonu ve parolası var, ikisi de **canlı bir dükkan sahibi**. `approveShop`'ta iki
  kırılma: doğrulama backfill'i `email: { not: null }` filtreliyor (asla eşleşmez) ve
  bildirim `if (partnerEmail)` ile uyarısız atlanıyor. SMS dalı çalıştığı için fark
  edilmemiş.
- **Neden önemli**: partnerlerin üçte ikisine e-postayla ulaşılamıyor, ama dükkanları
  rezervasyon alıyor.
- **Çözüm**: *kod* — partner kaydında e-posta zorunlu olsun (ya da mantık telefon
  farkında olsun ve atlanan bildirim loglansın). *Veri* — 2 satır için e-posta topla.

### [P1-4] Test dükkanı canlı aramada, üstelik 5 rezervasyonu var
- **Nerede**: `Shop` `131bcf6d-...` (`Furkan'ın Diğer Mekan`)
- **Kanıt** (kendim gördüm): `isActive = t`, `isVerified = f`. Genel aramanın tek
  filtresi `isActive = true AND latitude IS NOT NULL`.
- **Neden önemli**: Türkiye'de bulunabilen yalnızca üç dükkandan biri kişisel bir test
  kaydı ve gerçek partnerden ayırt edilemiyor.
- **Çözüm**: *veri* — `isActive = false`. (Silinemez: `rejectPendingShop` rezervasyonu
  olan dükkanı reddediyor.) Uzun vadede *kod* — `isTest` bayrağı.
- **Not**: Bunu SQL ile kapatmayı denedim, güvenlik sınıflandırıcısı engelledi —
  `/admin/partners` üzerinden senin yapman gerekiyor.

### [P1-5] 8 script rezervasyonu ve 1.520 TRY hayalet ödeme prod defterinde
- **Nerede**: `Booking`, `PaymentLog`; repo kökünde `load-test.js`
- **Kanıt**: 9 saniyelik pencerede, tek misafir, tek dükkan, hepsi `PAID` 190.00 olan
  8 rezervasyon. `load-test.js` dosyasının repo kökünde durduğunu teyit ettim.
  8 × 190 = **1.520 TRY**, kayıtlı 3.480 TRY hacminin %44'ü.
- **Neden önemli**: gelir, dönüşüm ve doluluk rakamlarının tamamı yanlış.
- **Çözüm**: *veri* — 8 rezervasyonu ve ödemelerini işaretle/temizle. Yük testi prod'a
  gitmemeli.

### [P1-6] 19 rezervasyonun 18'i çıkış saatini geçmiş halde açık; hiçbiri CHECKED_OUT olmamış
- **Kanıt**: durum dağılımı `PAID 10 | APPROVED 5 | CHECKED_IN 3 | CANCELLED 1` —
  **hiç CHECKED_OUT yok**, `BookingEvent`'te de sıfır CHECKED_OUT olayı. En eskisi
  12 Haziran'dan beri CHECKED_IN.
- **Neden önemli**: yaşam döngüsünün pratikte sonlanan bir durumu yok; üç müşterinin
  bavulu Haziran'dan beri "dükkanda" görünüyor.
- **Çözüm**: *operasyonel* — mutabakat/süre aşımı taraması (hiç yok). *Veri* — 3 eski
  CHECKED_IN satırı için karar.

### [P1-7] 1.277 mühür ASSIGNED, 1.247'si hiçbir dükkana bağlı değil
- **Kanıt**: `ASSIGNED 1277 (1247 shopId NULL) | STOCK 22 | FAULTY 2`. Ayrıca
  `BookingSeal` boş — 3 CHECKED_IN rezervasyona rağmen hiçbir mühür bir bavula
  kaydedilmemiş.
- **Neden önemli**: mühür envanteri anlaşmazlıklarda fiziksel zilyetlik kanıtı ve
  %96'sı bir dükkanla eşleştirilemiyor.
- **Çözüm**: *veri* düzeltmesi + *kod*: durum `STOCK`tan çıktığında `shopId` zorunlu
  olsun (DB check constraint).

### [P1-8] Bir rezervasyonun toplamı kendi valiz sayısıyla çelişiyor
- **Nerede**: `Booking` `3c98aa28-...`
- **Kanıt**: 19 toplamın 18'i `150 sabit + S·40 + M·100 + XL·150` modeline birebir
  oturuyor. İstisna: `S1 M3 XL1 → 540.00` (model 640, **100.00 eksik**). Bekleyen
  revizyon yok. Satır `CHECKED_IN` — 5 bavul teslim alınmış, 4'ü ödenmiş.
- **Neden önemli**: fiyat yeniden hesaplanmadan bavul eklenmiş.
- **Çözüm**: *kod* — valiz değişikliği aynı işlemde
  `computeAuthoritativeCheckoutTotals`'ı yeniden çalıştırıp farkı tahsil etmeli.

### [P1-9] Ödenmiş sayılan 7 rezervasyonun hiç ödeme kaydı yok
- **Kanıt**: `APPROVED 5 | CHECKED_IN 2` ödeme kaydı olmadan. İkisinde bavul zaten
  dükkana teslim edilmiş. (Kayıt olan yerlerde tutarlar tutarlı: uyuşmazlık 0.)
- **Neden önemli**: ödeme kanıtı olmayan rezervasyonlara karşı bavul kabul edilmiş.
- **Çözüm**: *kod* — check-in `SUCCESS` ödeme kaydı (veya açık "kapıda ödeme"
  işareti) şartı koşmalı.

### [P1-10] `checkOut` rezerve pencereyi eziyor; şemada gerçek giriş/çıkış zamanı yok
- **Nerede**: `src/services/BookingService.ts:574-588`
- **Kanıt**: `checkOutTime: now` yazması rezerve bitiş zamanını yok ediyor. `Booking`'de
  yalnızca *rezerve* pencere var; `checkedInAt`/`checkedOutAt` yok, gerçek geçişler
  sadece `BookingEvent`'te.
- **Neden önemli**: gecikme ücreti ve erken iade ikisi de `checkOutTime`'dan
  hesaplanıyor, dolayısıyla çıkıştan sonra faturanın girdileri yeniden kurulamıyor.
- **Çözüm**: *kod* — `checkedInAt`/`checkedOutAt` ekle; rezerve pencere değişmez olsun.

### [P1-11] Repodaki tek cron, uygulamanın çalışmadığı platformu hedefliyor; hiçbir ödeme paylaşımı tamamlanmamış
- **Kanıt**: `vercel.json` 15 dakikada bir `/api/internal/reconcile-payments`
  tanımlıyor. Prod Hetzner'de `docker compose` ile çalışıyor; orada `vercel.json`
  cron'unun hiçbir etkisi yok. `PaymentLog.splitCompleted` → 12 kaydın tamamı `false`.
  > Not: Hetzner'in kendi crontab'ında `reconcile-payments`'ı çağıran bir satır **var**
  > (15 dakikada bir curl). Yani bu madde "hiç çalışmıyor"dan çok "iki ayrı yerde iki
  > farklı zamanlama tanımı var, hangisinin geçerli olduğu belirsiz" sorunudur —
  > ama `splitCompleted` hepsi false olduğuna göre pratikte sonuç üretmiyor.
- **Çözüm**: *operasyonel* — zamanlamanın tek kaynağı host seviyesinde olsun,
  kaçırılan çalıştırma alarmıyla. `vercel.json` kayıt defteri değil.

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
