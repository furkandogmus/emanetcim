# Ürün ve iş kuralları

Bu belge BagajPark'ın ne yaptığını, rezervasyonun hangi kurallarla ilerlediğini ve
sahada (dükkan, destek, mühür) nasıl işlediğini tek yerde anlatır. Eski PRD, kullanım
senaryoları, iş kuralı matrisi, bildirim matrisi, partner el kitabı, personel listesi,
tedarik planı, destek/SLA, hukuki altyapı ve uygulama matrisi belgelerinin yerine
geçer (2026-11-23). Her kural kodda karşılığı olan haliyle yazıldı; kodda olmayan bir
vaat buraya girmez, `docs/PRODUCTION_BACKLOG.md`'ye girer.

Ayrıntılı kaynaklar: ödeme `docs/PAYMENTS.md`, sayısal kurallar
`docs/PLATFORM_SETTINGS.md`, zamanlanmış işler `scripts/README.md`, personalar
`docs/USER_PERSONAS.md`, kanıtlı hatalar `docs/DEFECT_BACKLOG.md`.

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

Rol yükseltme dört göz ilkesiyle onaylanır (`AdminRoleChangeRequest`, `/admin/role-approvals`);
son yönetici düşürülemez. Giriş: e-posta + şifre, Google, Apple (web ve iOS). SMS ile
giriş kapalı (`SMS_LOGIN_ENABLED`); OAuth kurulumu `docs/OAUTH.md`.

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
- Kapasite kontrolü slot satırları üzerinde kilitle yapılır (`ReservationSlot`);
  platform tatil günleri ve dükkan kapanışları (`ShopClosure`, `ShopWeeklyHours`)
  rezervasyonu reddeder. Bırakma takviminde geçmiş günler seçilemez.
- **Check-in** (`check-in.ts`): esnaf QR'ı okutur ya da kodu arar. QR imzalı JWT'dir
  (`src/lib/qr-token.ts`, en az 48 saat geçerli). Manuel sağlayıcıda tahsilat bu anda
  deftere yazılır, sonra durum `CHECKED_IN` olur. Mühür kaydı `requireSealsOnCheckIn`
  açıksa zorunludur (varsayılan kapalı). Kapanıştan sonra `checkInGraceMin` (30 dk)
  tolerans var; dükkan kapalı görünüyorsa sahip/yönetici "yine de teslim al" diyebilir
  (olaya `outside_hours` yazılır).
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
| Hasar / kayıp | Misafir itiraz açar; yönetici check-in mühür kaydı ve fotoğrafı ile karar verir | `DisputeService` |
| Kupon | Yönetici tanımlar (`/admin/coupons`, mobil "Kuponlar"); iptalde kupon iade edilir | `CouponService` |
| Davet indirimi | Başka bir misafirin kodu, ilk rezervasyonda, kuponsuz, ara toplamdan `REFERRAL_DISCOUNT_PCT` (varsayılan %5) | `ReferralService` |
| Yönetim bağlantısı | Hesapsız misafirin rezervasyon yönetim bağlantısı en fazla 7 gün geçerli | `guest-link.ts` |

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

### Tezgahta adımlar (personel için)

1. Misafirin QR'ını okut ya da rezervasyon kodunu ara.
2. Valizi dışarıdan kontrol et; seri numaralı mührü fermuara tak ve numarayı gir.
3. Valizi yalnız personelin girdiği alana koy.
4. Teslimde QR'ı yeniden okut, mührün sağlam olduğunu misafire göster, kopar, teslim et.
5. Valiz sayısı farklıysa revizyon yap; misafir gecikiyorsa ve arıyorsa "Misafiri bekle".

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
