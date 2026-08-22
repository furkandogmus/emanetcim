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
| Veri bütünlüğü + iş kuralları | ✅ tamamlandı | 5 P0, 11 P1, 7 P2 |
| Ödeme entegrasyonu durumu | ✅ tamamlandı | **1 P0 (kök neden)** |
| İç API / cron yetkilendirmesi | ✅ tamamlandı | 2 P1 |
| API rol/auth kapsaması (67 route) | ✅ tamamlandı | 0 yeni açık — bkz. "Doğrulanmış güvenli" |
| i18n anahtar bütünlüğü (14 dil) | ✅ tamamlandı | 1 P1 (138 anahtar × 12 dil) |
| Aralıklı 502 teşhisi | ✅ tamamlandı | 1 P1 — sebep uygulama değil, Cloudflare |
| IDOR / kaynak sahipliği | ✅ tamamlandı | **1 P0 bulundu ve düzeltildi** |
| Partner paneli (UI + yetenek) | ✅ tamamlandı | 1 P0 (düzeltildi) + 3 P1 |
| Admin paneli (UI + yetenek) | ✅ tamamlandı | 2 P1 (biri düzeltildi) + 2 P2 |
| Misafir rezervasyon akışı (UI) | ❌ yapılmadı | tek kalan yüzey |
| Misafir diğer sayfalar + auth (UI) | ❌ yapılmadı | kısmen: giriş sayfası incelendi |
| i18n çeviri KALİTESİ | ❌ yapılmadı | eksik anahtar sayıldı, yanlış çeviri taranmadı |

Yani aşağıdaki liste **eksiksiz değil** — yalnızca bir yüzeyin tam denetimini ve
21-22 Ağustos'ta elle bulunan hataları içeriyor. Kalan 6 yüzey hâlâ taranmayı bekliyor.

### En acil üç şey

1. **Hiçbir ödeme sağlayıcısı entegre değil**, ama `PaymentLog.status` varsayılanı
   `SUCCESS` ve kamuya açık sayfalar kartla tahsilat/iade vaat ediyor. Aşağıdaki
   maddelerin çoğunun kök nedeni bu (P0-0).
2. **Prod'daki 39 gerçek kullanıcı hesabına karşılık defterde 8 hayalet rezervasyon
   ve 1.520 TRY sahte ödeme var** (kayıtlı hacmin %44'ü) ve kaynağı hâlâ bilinmiyor
   — yani prod'a rezervasyon yazabilen bir yol açık olabilir (P1-5).
3. **19 rezervasyonun 18'i çıkış saatini geçmiş hâlde açık; hiçbiri hiç
   `CHECKED_OUT` olmamış.** Üç müşterinin bavulu Haziran'dan beri "dükkanda"
   görünüyor. Yaşam döngüsünün pratikte sonlanan bir durumu yok (P1-6).

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
- **Nerede**: `Booking`, `PaymentLog`
- **Kanıt**: 9 saniyelik pencerede, tek misafir, tek dükkan, hepsi `PAID` 190.00 olan
  8 rezervasyon. 8 × 190 = **1.520 TRY**, kayıtlı 3.480 TRY hacminin %44'ü.
- **Neden önemli**: gelir, dönüşüm ve doluluk rakamlarının tamamı yanlış.
- **Kaynak henüz belirsiz**: ilk değerlendirmede bunu repo kökündeki `load-test.js`'e
  atfetmiştim; **bu atıf yanlıştı.** Dosyayı okudum: yalnızca `/tr` ve `/tr/search`
  GET'liyor, hiçbir POST/checkout/rezervasyon çağrısı yok ve varsayılan hedefi
  `localhost:3000`. Yani bu 8 rezervasyonu o script üretmemiş. Gerçek kaynak
  bilinmiyor — elle yapılmış bir test ya da başka bir script olabilir.
- **Çözüm**: *veri* — 8 rezervasyonu ve ödemelerini işaretle/temizle. Ayrıca kaynağın
  ne olduğu bulunmalı; prod'a rezervasyon yazabilen bir test yolu varsa kapatılmalı.

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

### [P1-11] Zamanlanmış işlerin tek bir kayıt defteri yok
- **Kanıt**: iş tanımları üç ayrı yere dağılmış ve hiçbiri diğerini bilmiyor:
  `vercel.json` (uygulamanın çalışmadığı bir platform), Hetzner crontab'ı (gerçek
  yürütücü), ve hiç var olmayan işler (slot üretimi — bkz. P0-1). Sonuç: bir iş
  çalışmayı bıraktığında (P1-1b) veya hiç kurulmadığında (P0-1) kimse fark etmiyor.
- **Neden önemli**: bu, P0-1 ve P1-1b'nin ortak kök nedeni — tek tek hatalar değil,
  eksik bir kontrol düzlemi.
- **Çözüm**: *operasyonel* — zamanlamanın tek kaynağı host seviyesinde olsun,
  başarısız/kaçırılan çalıştırma alarmıyla. `vercel.json` kayıt defteri değil.

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

### [P1-18] Admin gelen kutusu spam altında; 67 mesajın 57'si okunmamış
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
- **Çözüm**: *kod* — gönderen/konu bazlı basit bir spam işaretleme + varsayılan
  "spam olmayanlar" görünümü; ya da iletişim formuna bot koruması (bu mesajların
  form üzerinden mi yoksa doğrudan e-posta ile mi geldiği ayrıca doğrulanmalı).

### [P2-8] Admin gelen kutusundaki toplu işlem metinleri i18n'i baypas ediyor
- **Nerede**: `src/components/admin/AdminMessagesClient.tsx:26-29`
- **Kanıt**: metinler bileşen içinde sabit bir tr/en üçlü operatörüyle yazılmış
  (`bulkCopy = locale === "tr" ? {...} : {...}`), locale dosyalarından gelmiyor.
  Sonuç: diğer 12 dilde toplu işlem arayüzü İngilizce çıkıyor.
- **Çözüm**: *kod* — anahtarları `Admin` namespace'ine taşı.

### [P2-9] Gelen kutusu satır aksiyonlarının erişilebilir adı yalnızca `title`
- **Nerede**: `src/components/admin/AdminMessagesClient.tsx:282-297`
- **Kanıt**: satır butonları `title={t("messagesMarkAsRead")}` / `title={t("messagesDelete")}`
  kullanıyor, `aria-label` yok. `title` çoğu tarayıcıda erişilebilir ad olarak kabul
  edilir, yani tamamen etiketsiz değiller — ama dokunmatik cihazda tooltip görünmez ve
  ekran okuyucu desteği tutarsızdır.
  > Not: ilk DOM taramamda bunları "124 etiketsiz buton" olarak saymıştım; yalnızca
  > `innerText`/`aria-label` kontrol ettiğim için yanlış çıktı. Kodu okuyunca durum
  > düzeltildi ve şiddet P2'ye indirildi.
- **Çözüm**: *kod* — `aria-label` ekle (`title` kalabilir).

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

### [P1-16] Esnaf, e-posta ile "ESNAF" sekmesinden giriş yapamıyor
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
- **Çözüm**: *kod* — ESNAF sekmesi de e-posta kabul etsin (girdiyi telefon/e-posta
  olarak otomatik ayırt et), ve giriş sonrası rol bazlı yönlendirme yapılsın
  (PARTNER → `/partner`).

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
