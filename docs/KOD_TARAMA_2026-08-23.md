# Kod Taraması — 2026-08-23

> Bu doküman `docs/DEFECT_BACKLOG.md`'den **ayrı**. O dosya prod DB sorguları ve canlı
> curl testleriyle doğrulanmış bulguları listeliyor; bu tarama ise **yalnızca statik kod
> okuması** ile CLAUDE.md'deki mimari kurallara karşı yapıldı — prod'a hiç erişilmedi,
> hiçbir sorgu çalıştırılmadı. Bulgular "kodda böyle yazılmış" seviyesinde; prod veriyle
> doğrulanmadan DEFECT_BACKLOG'a taşınmamalı.
>
> Yöntem: agent paralel başlatılmadan, alan alan sırayla tek oturumda tarandı.

## Taranan alanlar

| # | Alan | Durum |
|---|---|---|
| 1 | Yazma katmanı: "yazma yalnızca `src/services/`" kuralına uyum | ✅ tamamlandı — **1 gerçek bulgu** (1.1) |
| 2 | Modal a11y (`useModalBehavior` + `role="dialog"`) | ✅ tamamlandı — temiz, mandal testi yeşil |
| 3 | i18n: sabit iki dilli metin / `locale === "tr"` deseni | ✅ tamamlandı — temiz, tavan aşılmamış |
| 4 | Mühür (Seal) yazımı `SealService` dışında | ✅ tamamlandı — **1 gerçek bulgu** (4.1) |
| 5 | Web/mobil uç çatallanması (Auth.js vs jose ayrımı üzerinden bulundu) | ✅ tamamlandı — bkz. 4.1 |
| 6 | Zamanlanmış işler ↔ `src/lib/jobs/registry.ts` tutarlılığı | ✅ tamamlandı — temiz, mandal testi yeşil |
| 7 | Brute-force / oran sınırlama kapsaması (OTP, parola, token) | ✅ tamamlandı — **1 gerçek bulgu** (7.1) |
| 8 | Fiyat bütünlüğü: istemciden gelen tutarlara güven sınırı | ✅ tamamlandı — istismar yok, kırılgan tasarım (8) |
| 9 | Kupon suistimali (maxUses yarış koşulu) | ✅ tamamlandı — **1 gerçek bulgu** (9.1) |
| 10 | Yorum (review) bütünlüğü / sahte yorum | ✅ tamamlandı — **1 gerçek bulgu** (10.1) |
| 11 | Anlaşmazlık (dispute) akışı web/mobil paritesi | ✅ tamamlandı — **1 gerçek bulgu** |
| 12 | Push bildirim kaydı (web + mobil) | ✅ tamamlandı — temiz |
| 13 | Mobil token yenileme (refresh) | ✅ tamamlandı — temiz |
| 14 | Admin rol değişikliği / yetki yükseltme | ✅ tamamlandı — temiz, iyi tasarlanmış |
| 15 | SQL enjeksiyonu (`$queryRawUnsafe`/`Prisma.raw`) | ✅ tamamlandı — temiz |

---

## BACKLOG — düzeltme sırası

> Bu bölüm §1-11'deki bulguların **tek bakışta iş listesi**. Durum sütunu bu oturumda
> güncelleniyor; "Düzeltildi" satırları aynı oturumda uygulanan kod değişikliğiyle eşleşir.

| # | Bulgu | Önem | Dosya | Durum |
|---|---|---|---|---|
| B1 | 7.1 — OTP doğrulamada rate limit yok | Güvenlik (hesap ele geçirme) | `api/mobile/auth/session/route.ts` | ✅ Düzeltildi (2026-08-23) |
| B2 | 4.1 — Korumasız `shop.delete`, aktif rezervasyonlarla | Güvenlik (veri kaybı) | `api/mobile/admin/applications/[id]/[action]/route.ts` | ✅ Düzeltildi — dosya silindi (2026-08-23) |
| B3 | 10.1 — Web yorumunda `shopId` istemciden güveniliyor | Bütünlük (sahte yorum) | `actions/review.ts` | ✅ Düzeltildi (2026-08-23) |
| B4 | 1.1 — Partner/admin red, `cancelBooking()`'i atlıyor | Para/sadakat tutarsızlığı | `actions/partner.ts` | ✅ Düzeltildi (2026-08-23) |
| B5 | 9.1 — Kupon `maxUses` yarış koşulu | Para (düşük olasılık, yüksek etki) | `actions/booking.ts` | ✅ Düzeltildi (2026-08-23) |
| B6 | 11 — Mobil dispute, durum kontrolünü atlıyor | Tutarlılık | `api/mobile/disputes/route.ts` | ✅ Düzeltildi (2026-08-23) |
| B7 | 8 — Fiyat güven sınırı serviste değil çağıranda | Tasarım borcu, istismar yok | `services/booking/create.ts` | 📝 not düşüldü, refactor kapsamı büyük — ayrı ele alınacak |
| B8 | 12 — Mobil "yakındaki dükkanlar" ucu auth/rate-limit'siz | Kaynak tüketimi / scraping | `api/mobile/shops/nearby/route.ts` | ✅ Düzeltildi (2026-08-23) |

### Uygulanan değişiklikler (2026-08-23)

- **B1**: `session/route.ts`'nin `code` dalının başına parola dalıyla aynı desende
  `rateLimit(\`mobile_otp_verify:<kimlik>\`, 5, 15dk)` eklendi.
- **B2**: `src/app/api/mobile/admin/applications/[id]/[action]/route.ts` tamamen silindi
  (`git rm`) — hiçbir çağıranı yoktu, canlıda kullanılan tek nokta
  `/api/admin/applications/...` idi ve o zaten doğru korunuyordu.
- **B3**: `addReviewAction`, `reviewService.addReview({ ...data, shopId: booking.shopId })`
  çağırıyor artık — istemcinin gönderdiği `shopId` tamamen yok sayılıyor (mobil route'taki
  desenle birebir aynı).
- **B4**: `rejectBookingAction`, ham `prisma.booking.update` yerine
  `bookingService.cancelBooking(bookingId)` çağırıyor; sonuç `ok:false` ise
  `Errors.bookingStateConflict` dönüyor, `ok:true` ise aktöre özgü `BookingEvent` ayrıca
  kaydediliyor (metadata: kim reddetti/iptal etti).
- **B5**: Kupon `usedCount` atomik `updateMany`'si artık booking oluşmadan ÖNCE
  çalışıyor; kota dolmuşsa (`count: 0`) indirim hiç uygulanmıyor, booking tam fiyattan
  devam ediyor. Booking oluşturma sonradan başarısız olursa (`catch` bloğu), önceden
  alınmış kota hakkı `usedCount: { decrement: 1 }` ile iade ediliyor.
- **B6**: `mobile/disputes/route.ts`'e web'deki `CHECKED_IN`/`CHECKED_OUT` durum kontrolü
  eklendi; `P2002` (tekrar dispute) artık 500 yerine `duplicate_dispute` (409) dönüyor.
- **Regresyon testleri eklendi**: `AuditFixes.test.ts`'e B3 ve B5 için birer test; B4 için
  mevcut "Audit Fix #2" testi yeni davranışa (raw update yerine `cancelBooking()` çağrısı)
  göre güncellendi.
- **Doğrulama**: `npm run typecheck && npm run lint && npm test` — hepsi yeşil
  (0 hata, 374 test geçti + 1 pre-existing skip; lint'teki 15 uyarı bu değişikliklerden
  önce de vardı, dokunulmadı).
- `.next/` içindeki stale route-validator önbelleği silinen dosyayı hâlâ referans
  aldığı için typecheck ilk denemede sahte hata verdi; `rm -rf .next` ile temizlendi
  (kod hatası değildi).

### SQL enjeksiyonu — temiz

**Öncelik sırası** (ikisi de kod okumasıyla doğrulandı, ikisi de prod'da tetiklenip
tetiklenmediği doğrulanmadı):

1. **BULGU 7.1** — güvenlik: mobil OTP girişinde 6 haneli kodun tahmin edilmesine karşı
   hiçbir sınır yok. Hesap ele geçirme riski, düzeltmesi tek satır.
2. **BULGU 4.1** — güvenlik: kullanılmayan mobil uç, korumasız `shop.delete` + cascade,
   aktif rezervasyonları geri dönüşsüz silebilir. Düzeltmesi ucuz (dosyayı sil ya da
   ortak fonksiyona yönlendir).
3. **BULGU 10.1** — bütünlük: web'den yorum eklerken `shopId` istemciden alınıyor,
   `bookingId`'nin gerçek dükkanıyla karşılaştırılmıyor — herhangi bir dükkana sahte
   yorum/puan yazılabilir. Düzeltmesi mobil route'taki deseni kopyalamak kadar basit.
4. **BULGU 1.1** — para/sadakat tutarsızlığı: partner/admin red akışı `lifecycle
   .cancelBooking()`'i atlıyor, açık ödeme niyeti ve sadakat puanı geri alınmıyor.
5. **BULGU 9.1** — kupon `maxUses` sınırı, dar bir eşzamanlılık penceresinde aşılabiliyor;
   "atomik" düzeltme yalnızca sayacı koruyor, zaten verilmiş indirimi geri almıyor.
6. **BULGU 8** — düşük öncelik: fiyat hesaplama güven sınırı serviste değil çağıranda;
   bugün istismar yok, gelecekte yeni bir çağıran eklenirse risk taşıyor.

---

## 7) Kimlik doğrulama — brute-force / oran sınırlama kapsaması

`src/lib/rate-limit.ts`'i kullanan tüm noktaları çıkardım, sonra OTP zincirinin tamamını
(gönder → doğrula) uçtan uca okudum.

### BULGU 7.1 — Mobil OTP ile giriş: kodu GÖNDERMEK sınırlı, kodu TAHMİN ETMEK sınırsız

- **Nerede**: `src/app/api/mobile/auth/session/route.ts:43-73` (aynı dosyanın parola dalı,
  `:74-99`, doğru şekilde korunuyor — karşılaştırma için aşağıda).
- **Zincir**:
  1. `POST /api/mobile/auth/otp` — kod göndermek `rateLimit(mobile_otp:<kimlik>, 3, 2dk)`
     ve `rateLimit(mobile_otp_ip:<ip>, 10, 5dk)` ile sınırlı (`otp/route.ts:32-37`) →
     doğru.
  2. `POST /api/mobile/auth/session` (`{ email|phone, code }` gövdesiyle) — kod, 6 haneli
     rastgele sayı (`randomInt(100000, 999999)`, `otp/route.ts:39`), 5 dakika geçerli. Bu
     uçta `code` dalı **hiçbir `rateLimit(...)` çağrısı içermiyor** — sadece
     `prisma.verificationToken.delete({ where: { identifier_token: { identifier, token: code } } })`
     deneyip başarısızsa `catch(() => null)` ile yutuyor (`session/route.ts:43-50`).
  - **Doğrudan karşılaştırma, aynı dosya, bir alt dal**: `password` ile girişte
    (`session/route.ts:74-77`) ilk satır
    `rateLimit(\`mobile_pwd:${normalizedIdentity}\`, 5, 15 * 60_000)` — yani parola
    dalı doğru korunmuş, kod dalı unutulmuş. Aynı fonksiyonun içinde, birkaç satır arayla.
- **Neden ciddi**: 6 haneli kod = 900.000 olası değer (100000-999999). Sınırsız deneme
  hakkıyla, saldırganın hedefin e-posta/telefonunu bilmesi yeterli (referans kodu,
  sızmış e-posta listesi, ya da kendi hesabından tahmin) — 5 dakikalık pencerede kaba
  kuvvetle kod bulma, hız sınırlaması olmadan (uygulama seviyesinde) tamamen mümkün.
  Başarılı tahmin doğrudan `accessToken`/`refreshToken` üretip **hesaba giriş sağlıyor**;
  hedef kullanıcı `User.create`'e düşmeyecek kadar zaten kayıtlıysa mevcut hesabı ele
  geçiriyor.
- **Doğrulanmadı (prod'a dokunmadım)**: altyapı seviyesinde (Cloudflare/nginx) genel bir
  istek hız sınırı olup olmadığı — varsa etkiyi azaltır ama uygulama kendi başına hiç
  korumuyor.
- **Önerilen düzeltme**: parola dalındakiyle birebir aynı desen — `code` dalının başına
  `if (!(await rateLimit(\`mobile_otp_verify:${normalizedIdentity}\`, 5, 15 * 60_000)))
  return 429` eklemek. `otp/route.ts`'deki gönderim sınırlamasıyla karıştırılmasın: bu,
  ayrı bir anahtar/sınır olmalı çünkü doğrulama denemesi göndermekten farklı bir eylem.

### Karşılaştırma — diğer token akışları güvenli (sınırsız ama yüksek entropili)

`password-reset/confirm` (`src/app/api/mobile/auth/password-reset/confirm/route.ts`) ve
`verify-email` (`.../verify-email/route.ts`) de `rateLimit` çağırmıyor, ama token
`crypto.randomUUID()` ile üretiliyor (`src/lib/password-reset-token.ts:25`, `src/lib/
tokens.ts:11`) — 122 bit entropi, kaba kuvvetle bulunamaz. Buradaki eksik savunma-derinliği
seviyesinde, BULGU 7.1'deki gibi gerçek bir açık değil.

---

## 8) Fiyat bütünlüğü — güven sınırı servis katmanında değil, çağıranda

`src/services/booking/create.ts`'in imzası (`CreateInitialBookingInput`) `totalPrice`,
`unitPrice`, `insuranceFee`, `referralDiscountAmount` alanlarını **istemciden geliyormuş
gibi** kabul ediyor ve yalnızca "sayı mı, negatif değil mi" diye bakıyor
(`create.ts:45-51,64-67,193-195` — `typeof x === 'number' ? x : ...Math.max(0, x)`),
**hiçbir yerde `computeAuthoritativeCheckoutTotals`'ı kendisi çağırmıyor**.

Bunun canlıda istismar edilebilir olup olmadığını görmek için `createInitialBooking`'in
**iki gerçek çağıranını** da tek tek okudum:

- `src/actions/booking.ts:118-203` (misafir web rezervasyonu) — `totalPrice`,
  `unitPrice`, `insuranceFee`'yi `computeAuthoritativeCheckoutTotals`'tan alıyor;
  kupon ve referans indirimini de sunucuda (`coupon.discount`, `REFERRAL_DISCOUNT_PCT`)
  hesaplıyor, istemciden yalnızca `couponCode`/`referralCode` metnini okuyor, tutarı
  değil. **Temiz.**
- `src/app/api/mobile/checkout/intent/route.ts:50-71` (mobil checkout) — aynı şekilde
  `computeAuthoritativeCheckoutTotals`'tan üretilen `totals`'ı geçiriyor; kupon/referans
  alanlarını `zod` şeması hiç kabul etmiyor. **Temiz.**

**Sonuç: bugün istismar edilebilir bir açık YOK** — servis katmanına giden her yol,
çağıran tarafından önceden doğru hesaplanmış. Ama bu **kırılgan bir tasarım**: güven
sınırı `create.ts`'te değil, her çağıranın kendi disiplininde duruyor. Yarın üçüncü bir
çağıran eklenirse (yeni bir mobil ekran, bir admin "rezervasyon oluştur" formu, bir
script) ve o çağıran `computeAuthoritativeCheckoutTotals`'ı unutursa,
`createInitialBooking` bunu **hiçbir şekilde yakalamaz** — tip imzası istemci şeklini
taşıdığı için "güvenilmez veri" gibi görünmüyor bile.

- **Önerilen düzeltme**: `computeAuthoritativeCheckoutTotals`'ı çağıranın değil,
  `createInitialBooking`'in kendisinin çağırmasını sağlamak (fiyat girdisi olarak
  `shopId`/`bagCount*`/tarih alması, `totalPrice`/`unitPrice` almaması) — CLAUDE.md'nin
  "para yalnızca ilgili servisle değişir" ilkesiyle birebir aynı mantık, burada da
  uygulanmalı. Asgari olarak: fonksiyonun üstüne "bu alanlar yalnızca zaten doğrulanmış
  çağıranlar için, doğrudan istemci girdisi GEÇİRMEYİN" uyarısı eklenmeli.

---

## 9) Kupon suistimali — "atomik" düzeltme yalnızca sayacı koruyor, indirimi değil

`usedCount`'un yarış koşuluna karşı atomik arttığı zaten bilinen bir düzeltme
(`src/__tests__/AuditFixes.test.ts` — "Audit Fix #1"). O testi ve gerçek çağrı sırasını
birlikte okudum; **koruma yanlış yere konmuş**.

### BULGU 9.1 — Kupon kotası doluyken bile indirim rezervasyona işleniyor; yalnızca sayaç artmıyor

- **Nerede**: `src/actions/booking.ts:118-255`
- **Sıra**:
  1. `:139-140` — kupon geçerliliği **eski (`stale`) bir okumayla** kontrol ediliyor:
     `coupon.usedCount < coupon.maxUses` (booking oluşmadan önce yapılan tek `findUnique`).
  2. `:144-157` — indirim `totalPrice`'a uygulanıyor.
  3. `:187` — `bookingService.createInitialBooking({ totalPrice, ... })` çağrılıyor;
     **indirimli tutar artık `Booking.totalPrice` olarak kalıcı**.
  4. `:241-248` — ancak bu noktadan SONRA, `usedCount`'u atomik arttırmaya çalışıyor
     (`updateMany({ where: { usedCount: { lt: maxUses } }, data: { increment: 1 } })`).
     Kota doluysa `updateCount.count === 0` oluyor ve kod şunu yapıyor:
     ```ts
     // Kupon kotası doldu, booking zaten oluştu ama indirimsiz bırakılmalı
     logger.warn({ couponId: appliedCouponId, bookingId: booking.id }, "coupon_quota_exceeded_after_booking");
     ```
     Yorumun kendisi doğru teşhis koyuyor ("indirimsiz bırakılmalı") ama **kod bunu
     yapmıyor** — sadece log basıp geçiyor. Booking, adım 3'te zaten indirimli fiyatla
     oluşmuş durumda; geri alma/fiyat düzeltme yok.
- **Neden önemli**: `maxUses` sınırı olan bir kupon (örn. "ilk 100 kullanıcı") kotanın
  tam sınırında eşzamanlı birkaç istekle çağrılırsa, hepsi 1. adımdaki eski okumayı
  geçer, hepsi indirimli fiyatla rezervasyon oluşturur; yalnızca **sayaç** doğru durur
  (`maxUses`'ı aşmaz) — ama gerçekte verilen indirim sayısı `maxUses`'ı aşar. Yani
  "Audit Fix #1" testi doğru şeyi ölçüyor (sayaç yarışması) ama **yanlış sonucu**
  "düzeltildi" sanıyor — asıl iş kuralı (kupon en fazla N kez indirim versin) hâlâ
  delinebilir.
- **Ölçek**: eşzamanlılık penceresi dar (iki `await` arası), yani günlük trafikte kendi
  kendine sık tetiklenmez; ama bir kampanya linkinin paylaşılıp kısa sürede çok sayıda
  eşzamanlı istek geldiği an (tam da `maxUses` kuponlarının var olma amacı) risk en
  yüksek olduğu an.
- **Önerilen düzeltme**: kota kontrolünü ve `totalPrice` hesaplamasını **tek
  transaction içinde**, booking'i yaratmadan önce atomik `updateMany` ile yap (increment
  başarısızsa kuponu hiç uygulama, `totalPrice`'ı indirimsiz kullan) — increment'i
  booking'den sonraya bırakma.

## 10) Yorum (review) bütünlüğü — BULGU 10.1: web yolu, yorumu istenen dükkana değil, istemcinin söylediği dükkana yazıyor

- **Nerede**: `src/actions/review.ts:10-49` (`addReviewAction`)
- **Karşılaştırma — mobil aynı işi doğru yapıyor**: `src/app/api/mobile/reviews/route.ts:19-32`
  `booking`'i DB'den `bookingId` ile çekip **`shopId`'yi `booking.shopId`'den** alıyor,
  istemciden `shopId` hiç kabul etmiyor.
- **Web yolu** `data.shopId`'yi (Server Action'ın gövdesinden, yani doğrudan istemciden)
  hiç doğrulamadan `reviewService.addReview()`'a geçiyor:
  ```ts
  // src/actions/review.ts
  const booking = await prisma.booking.findUnique({ where: { id: data.bookingId } });
  if (!booking || booking.guestId !== session.user.id) return { success: false, ... };
  if (booking.status !== "CHECKED_OUT") return { success: false, ... };
  // booking.shopId hiç okunmuyor / karşılaştırılmıyor
  const review = await reviewService.addReview(data);   // data.shopId ISTEMCIDEN
  ```
  Sahiplik (`guestId`) ve durum (`CHECKED_OUT`) kontrol ediliyor — ama **`shopId`'nin
  gerçekten o `bookingId`'ye ait olup olmadığı hiç kontrol edilmiyor.**
- **Neden ciddi**: `Review.bookingId` `@unique` olduğu için bir rezervasyon yalnızca bir
  kez yorumlanabiliyor (doğru), ama o tekil yorumun **hangi dükkana** yazılacağı
  tamamen istemcinin beyanına bağlı. Next.js Server Action'ları normal bir HTTP uç
  noktası gibi doğrudan çağrılabilir (UI'yi atlayıp elle `POST` ile) — yani gerçek bir
  misafir, kendi tamamlanmış TEK rezervasyonunu "bilet" olarak kullanıp
  **istediği herhangi bir dükkana** (hiç konaklamadığı, hatta rakip bir dükkana) 1
  yıldız sahte yorum bırakabilir ya da tersine kendi dükkanına (partnerse) 5 yıldız
  yazabilir — `ShopService.updateShopAverageRating` bunu doğrudan `shop.rating`
  ortalamasına katıyor.
- **Doğrulanmadı**: prod'da böyle bir yorum olup olmadığı (`Review.shopId !=
  (SELECT shopId FROM Booking WHERE id = Review.bookingId)` sorgusuyla tek seferde
  görülür) — bakmadım.
- **Önerilen düzeltme**: mobil route'taki deseni birebir kopyala — `addReviewAction`
  içinde `reviewService.addReview({ ...data, shopId: booking.shopId })` (istemcinin
  gönderdiği `shopId`'yi tamamen yok say).

## 12) Arama/coğrafi filtreleme — mobil "yakındaki dükkanlar" ucu tamamen açık

- **Nerede**: `src/app/api/mobile/shops/nearby/route.ts`
- **Karşılaştırma**: web eşdeğeri `src/actions/search-shops.ts:22-24`
  `rateLimit(\`search_refresh:${ip}\`, 30, 60_000)` ile korunuyor. Mobil route ise
  ne `requireMobileUser` (kasıtlı — misafir arama girişsiz olmalı) ne de herhangi bir
  `rateLimit` çağrısı içeriyordu; `src/proxy.ts` da yalnızca `/api/internal/*`'ı koruyor
  (`proxy.ts:103,125`), `/api/mobile/*` için genel bir sınır yok.
- **Neden önemli**: `shopService.findShopsForSearch` → `getActiveShopsOrderedByDistanceKm`
  PostGIS sorgusu başarısız olursa **tüm aktif dükkanları belleğe çekip** Haversine ile
  sıralayan bir yedek yola düşüyor (`shop-distance-postgis.ts:44-68`). Kimlik doğrulama ve
  hız sınırı olmadan bu uç, dükkan sayısı büyüdükçe kaynak tüketimine (scraping / kaba
  yeniden-deneme) tamamen açık kalıyordu.
- **Düzeltildi (2026-08-23)**: web'deki aynı desen — `rateLimit(\`mobile_shops_nearby:<ip>\`,
  30, 60sn)` — route'un başına eklendi.

## 11) Anlaşmazlık (dispute) akışı — mobil, web'in durum kuralını atlıyor

- **Nerede**: `src/app/api/mobile/disputes/route.ts:14-31` vs `src/actions/dispute.ts:19-45`
- **Web** (`createDisputeAction`) rezervasyon durumu `CHECKED_IN` ya da `CHECKED_OUT`
  değilse reddediyor (`dispute.ts:30-35`) — mantıklı: `DAMAGE`/`THEFT` iddiası, valizin
  fiziksel olarak dükkanda olmasını/olmuş olmasını gerektirir.
- **Mobil** aynı kontrolü yapmıyor — yalnızca `booking.guestId === auth.user.id`
  kontrol ediliyor, durum hiç okunmuyor. Sonuç: mobilden, henüz check-in bile
  olmamış (`PENDING`/`WAITING_APPROVAL`/`APPROVED`) bir rezervasyon için "hasar/hırsızlık"
  anlaşmazlığı açılabiliyor.
- **Ek küçük fark**: `Dispute.bookingId` `@unique` (`schema.prisma:359`); web bunu önceden
  `findUnique` ile kontrol edip kullanıcı dostu `Errors.duplicateDispute` döndürüyor,
  mobil ise `try/catch` ile P2002'yi ayırt etmeden genel `server_error` (500) veriyor —
  fonksiyonel değil ama UX/gözlemlenebilirlik açısından yanıltıcı (gerçek sunucu
  hatasıyla karışır).
- **Önerilen düzeltme**: mobil route'a web'deki durum kontrolünü ekle; P2002'yi
  `duplicate_dispute` (409) olarak ayır.

### SQL enjeksiyonu — temiz

`$queryRawUnsafe`/`$executeRawUnsafe` kullanılan 2 nokta (`ShopService.ts:348`,
`SlotService.ts:269`) da kullanıcı girdisini `$1`/`$2` pozisyonel parametre olarak ayrı
geçiriyor, string birleştirme yok. `Prisma.raw()` kullanılan tek yer
(`shop-distance-postgis.ts:24`) sabit bir SQL parçası (`PUBLIC_SHOP_SQL_CONDITION`)
enjekte ediyor, kullanıcı girdisi değil — ve bu sabitin `Prisma`'nın tip-güvenli `where`
karşılığıyla (`PUBLIC_SHOP_FILTER`) ayrışmasını `public-shop-filter.test.ts` zaten
yakalıyor. Ek bulgu yok.

---

## 2) Modal a11y, 3) i18n sabit metin, 6) jobs registry — mevcut mandal testleriyle zaten kapsanıyor

Bu üç alan için tekerleği yeniden icat etmek yerine ilgili mandal testlerini çalıştırdım
(hepsi **yeşil**, 2026-08-23):

```
npx vitest run src/__tests__/modal-a11y.test.ts        # 2/2 geçti
npx vitest run src/locales/locales.test.ts \
               src/__tests__/hardcoded-copy.test.ts \
               src/__tests__/input-labels.test.ts \
               src/__tests__/jobs-registry.test.ts     # 35/35 geçti
```

- **Modal a11y**: `role="dialog"` taşıyan 16 bileşenin tamamı ya `useModalBehavior`
  kullanıyor ya da elle `"Escape"` işliyor (test ikisini de kabul ediyor). Yeni ihlal yok.
- **Sabit iki dilli metin**: tavan (`HARDCODED_COPY_CEILING`) hâlâ **12** ve gerçek sayı
  onu aşmıyor. Kalan borç testin kendi yorumunda listeli:
  `luggage-storage/[slug]` (3), `cancellation` (2), `insurance` (2), `page.tsx` (1),
  `account` (1), `BookingsClient` (1), iki admin sayfası (2) — bunlar zaten bilinen,
  DEFECT_BACKLOG'daki "misafir diğer sayfalar taranmadı" notuyla örtüşen borç.
- **Jobs registry**: `src/lib/jobs/registry.ts` ↔ `/api/internal/*` uçları arasında
  kayıt defterinde olmayan bir uç ya da tersi yok.

Bu üçü için ek bulgu yok; ratchet testler görevini yapıyor.

---

## 1) Yazma katmanı: "yazma yalnızca `src/services/`" kuralına uyum

CLAUDE.md: *"Yazma işlemleri yalnızca `src/services/` üzerinden. ... `app/` ve `actions/`
Prisma'yı okuma için doğrudan kullanabilir."*

Gerçek: `src/actions/` içinde **37 dosya-satırı**, `src/app/api/` içinde **26 dosya**
doğrudan `prisma.<model>.(create|update|upsert|delete)` çağırıyor. Bu, kuralın çok geniş
ölçekte ihlal edildiği (muhtemelen kural sonradan yazılıp eski koda uygulanmadığı) anlamına
geliyor. Çoğu (User, Shop, Campaign, BlogPost, ContactMessage, FeatureFlag, BlockedIp,
AdminRoleChangeRequest, Coupon, Dispute, SealRequest) düşük riskli CRUD — servise taşınması
gereken borç, ama acil değil.

**Ama bir tanesi gerçek bir davranış farkına yol açıyor:**

### BULGU 1.1 — Partner/admin rezervasyon reddi, `lifecycle.cancelBooking()`'i atlıyor: para intent'i ve sadakat puanı geri alınmıyor

- **Nerede**: `src/actions/partner.ts:361-397` (`rejectBookingAction`)
- **Karşılaştırma**: misafirin kendi iptali üç ayrı yerden (`src/app/api/bookings/guest-cancel/route.ts:43`,
  `src/app/api/mobile/bookings/[id]/cancel/route.ts:20`, `src/actions/booking.ts:372`)
  hep `bookingService.cancelBooking()` → `src/services/booking/lifecycle.ts:53` çağırıyor.
  O fonksiyon üç şey yapıyor:
  1. `paymentService.cancelIntent({ bookingId })` — açık ödeme niyetini kapatır
     (`lifecycle.ts:97-99`)
  2. `reservationSlot` satırlarını transaction içinde siler (`lifecycle.ts:108-110`)
  3. **Sadakat puanını geri alır**: `UPDATE "User" SET loyaltyPoints = GREATEST(0,
     loyaltyPoints - earnedPoints)` (`lifecycle.ts:117`) — puan kazanımı
     `src/actions/booking.ts:261`'de rezervasyon oluşurken ekleniyor.
- **`rejectBookingAction` bunların hiçbirini yapmıyor** — sadece:
  ```ts
  await prisma.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.CANCELLED } });
  void bookingEventService.record({ ... }).catch(() => {});
  ```
  (`src/actions/partner.ts:386-397`)
- **Kimi etkiliyor**: partner bir `WAITING_APPROVAL` talebi reddettiğinde, ya da admin bir
  `APPROVED` rezervasyonu iptal ettiğinde (`partner.ts:379,382` — partner yalnızca
  WAITING_APPROVAL'ı, admin ayrıca APPROVED'ı da reddedebiliyor).
- **Sonuç**:
  - Rezervasyon oluşurken kazanılan sadakat puanı (`booking.ts:261`, tutarın tam sayı
    kısmı kadar) reddedilen/iptal edilen rezervasyon için **asla geri alınmıyor** — misafir
    hiç gerçekleşmeyen bir rezervasyondan puan biriktirmeye devam ediyor.
  - Eğer bu rezervasyon için `PaymentService` üzerinden açılmış bir `PENDING` ödeme niyeti
    varsa (checkout intent akışı — bkz. `src/app/api/mobile/checkout/intent/route.ts`),
    reddedilince o niyet **açık kalıyor**; defterde asılı `PENDING` satır olarak kalabilir.
  - `reservationSlot` satırı siliniyor değil ama bu tarafta zararsız: `SlotService
    .getSlotAvailability` sorgusu `booking.status` filtresine `CANCELLED`'ı almıyor
    (`src/services/SlotService.ts:161-171`), yani kapasiteyi yanlış düşürmüyor — sadece
    tabloda öksüz satır olarak kalıyor (veri hijyeni, işlevsel değil).
- **Doğrulanması gereken (prod erişimi olmadan bakamadım)**: reddedilen `APPROVED`
  rezervasyonların gerçekten `PENDING` `PaymentLog` satırı bırakıp bırakmadığı — yani
  checkout-intent akışının `APPROVED` durumundan önce mi sonra mı tetiklendiği kod
  okumasıyla netleşmedi, DB'den sayılmalı.
- **Önerilen düzeltme**: `rejectBookingAction`, ham `prisma.booking.update` yerine
  `bookingService.cancelBooking(bookingId)` çağırmalı (guest-cancel ile aynı yol), sonra
  gerekirse reddeden aktörü/nedeni ayrı bir `BookingEvent` metadata'sı olarak eklemeli.

### Diğer yazma-katmanı ihlalleri (listelendi, derinlemesine incelenmedi)

Aşağıdaki modeller `actions/` veya `app/api/` içinde doğrudan `prisma.<model>.update|create
|delete|upsert` ile yazılıyor, servis katmanından geçmiyor. Para (`PaymentLog`) ve mühür
(`Seal`, üç istisna dışında — bkz. §4) bunun dışında, temiz:

`User`, `Shop`, `Review`, `Campaign`, `BlogPost`, `ContactMessage`, `FeatureFlag`,
`BlockedIp`, `AdminRoleChangeRequest`, `Coupon`, `Dispute`, `SealRequest`,
`VerificationToken`, `PlatformSettings`.

En yoğun dosya: `src/actions/admin-management.ts` (9 ayrı ham yazma). Bunlar CRUD-seviyeli
(kullanıcı/dükkan onay-red, kampanya yönetimi) ve incelediğim kadarıyla iş kuralı
tekrarı/çatallanması içermiyor — yani BULGU 1.1'deki gibi "iki yerde farklı davranış" riski
taşımıyorlar. Servise taşınmaları mimari borç, acil bug değil.

---

## 4) ve 5) Mühür yazımı + web/mobil uç çatallanması — BULGU 4.1: "ölü" ama tehlikeli bir uç var

§1'deki grep, `Seal` tablosuna `SealService` dışında yalnızca iki dosyada dokunulduğunu
gösterdi — ikisi de dükkan başvurusu reddedilince "sahipsiz kalan mühürleri STOKa döndür"
temizliği:

- `src/app/api/admin/applications/[id]/[action]/route.ts`
- `src/app/api/mobile/admin/applications/[id]/[action]/route.ts`

Bu ikisinin **aynı işi iki kere yazan bir çift** olduğunu doğrulamak için ikisini de tam
okudum. Aynı işi yapmıyorlar — ve fark, gerçek bir güvenlik açığı:

### BULGU 4.1 — `mobile/admin/applications/[id]/reject` dükkanı hiçbir kontrol olmadan siliyor; aktif rezervasyonları olsa bile

- **Canlıda kullanılan uç**: Flutter admin ekranı `dio.post('/admin/applications/$id/$action')`
  çağırıyor (`mobile/lib/features/admin/admin_applications_screen.dart:58`) — yani
  **`/api/admin/applications/...`** (mobil isim uzayında DEĞİL). Bu uç doğru davranıyor:
  ```ts
  // src/app/api/admin/applications/[id]/[action]/route.ts:19-31
  } else if (action === "reject") {
    const activeBookingCount = await prisma.booking.count({
      where: { shopId: id, status: { in: ["APPROVED", "PAID", "CHECKED_IN"] } },
    });
    if (activeBookingCount > 0) {
      return NextResponse.json({ error: "Shop has active bookings; cannot delete." }, { status: 409 });
    }
    await prisma.shop.delete({ where: { id } });
    await prisma.seal.updateMany({ where: { shopId: id, status: "ASSIGNED" }, data: { status: "STOCK", shopId: null, assignedAt: null } });
  }
  ```
- **Kullanılmayan ikizi**, `src/app/api/mobile/admin/applications/[id]/[action]/route.ts`,
  aynı korumayı **yanlış dala** koymuş — `approve`'a (hiç yıkıcı olmayan işlem):
  ```ts
  // src/app/api/mobile/admin/applications/[id]/[action]/route.ts:17-30
  if (action === "approve") {
    const activeBookingCount = await prisma.booking.count({ where: { shopId: id, status: {...} } });
    if (activeBookingCount > 0) {
      return NextResponse.json({ error: "Shop has active bookings; cannot delete." }, { status: 409 });
    }
    await prisma.shop.update({ where: { id }, data: { isActive: true } });
  } else if (action === "reject") {
    await prisma.shop.delete({ where: { id } });        // <-- KORUMA YOK
    await prisma.seal.updateMany({ ... });
  }
  ```
  `reject` dalında **hiçbir aktif-rezervasyon kontrolü yok** — direkt `shop.delete`.
  Hata mesajı da yanlış dalda: "Shop has active bookings; cannot delete" onay (approve)
  başarısız olunca kullanıcıya gösteriliyor, ama approve hiçbir şeyi silmiyor ki.
- **Neden ciddi**: `prisma/schema.prisma`'da `Booking.shop` ilişkisi
  `onDelete: Cascade` (`schema.prisma:248`). Yani bu uca bir `POST` isteği —
  geçerli bir ADMIN rolündeki mobil erişim jetonuyla, uygulamanın kendisi bu uca hiç
  gitmese bile `curl`/Postman ile doğrudan — **aktif rezervasyonları olan bir dükkanı ve
  o rezervasyonların hepsini geri dönüşsüz siler.** Canlı uç (`/api/admin/applications/...`)
  tam bunu önlemek için 409 döndürüyor; ikizi önlemiyor.
  Bu tam olarak DEFECT_BACKLOG'daki P0-6'nın (SealService'i atlayan ham prisma yazması,
  IDOR) aynı ailesinden bir desen: **doğru kod bir yerde var, ikinci bir kopya onu
  tekrar etmiyor.**
- **Doğrulanmadı (prod'a dokunmadım)**: bu ucun gerçekten hâlâ ayakta olup olmadığı ve
  geçerli bir ADMIN mobil erişim jetonuyla dıştan çağrılabilirliği — kod okumasıyla uç
  route olarak mevcut ve `requireMobileUser`+`requireRole(["ADMIN"])` dışında hiçbir ek
  koruma taşımıyor, yani route seviyesinde erişilebilir görünüyor.
- **Önerilen düzeltme**: en basiti bu ikinci dosyayı tamamen silmek (canlıda kullanılan
  tek nokta zaten `/api/admin/applications/...`) ya da ikisini de aynı yardımcı
  fonksiyona (örn. `ShopService.rejectApplication`) yönlendirmek — böylece koruma tek
  yerde yaşar ve bir daha çatallanamaz.
- **Karşı-örnek (iyi örnek)**: `src/app/api/admin/messages/[id]/route.ts` ve
  `src/app/api/mobile/admin/messages/[id]/route.ts` aynı deseni doğru uyguluyor — iş
  mantığı birebir aynı, yalnızca auth kontrolü (web `auth()` vs mobil
  `requireMobileUser`) farklı. Uyarı burada spesifik: **kopyalanan iş mantığı**, kopyalanan
  auth kontrolü değil.

---
