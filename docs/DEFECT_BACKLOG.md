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
| Veri bütünlüğü + iş kuralları | ✅ tamamlandı | 5 P0 (3'ünün mimarisi kapatıldı), 11 P1, 7 P2 |
| Ödeme entegrasyonu durumu | ✅ tamamlandı | **1 P0 — mimarisi düzeltildi (`docs/PAYMENTS.md`)** |
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
- **Kaynak henüz belirsiz**: ilk değerlendirmede bunu repo kökündeki `load-test.js`'e
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
