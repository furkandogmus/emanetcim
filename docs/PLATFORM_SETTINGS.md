# Platform ayarları (merkezi iş kuralları)

Tek kaynak: Prisma `PlatformSettings` (`id = "default"`), okuma için [`getPricingRules()`](../src/lib/platform-settings.ts) (60 saniyelik bellek önbelleği). Varsayılanlar `src/lib/pricing-rules.ts` ile şemada aynı olmak zorunda (`pricing-defaults.test.ts`); bu varsayılanlar canlı fiyatı değiştirmez, prod satırı yalnızca yönetim arayüzünden değişir.

## Yönetim arayüzü

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

## Önbellek

`updatePlatformSettingsAction` kayıttan sonra `invalidatePricingRulesCache()` çağırır; aynı süreçte yeni kurallar hemen, diğer okuyucularda en geç 60 saniyede geçerlidir.

## Audit

`PlatformSettings.updatedAt` son değişiklik zamanını tutar ve ekranda gösterilir; her değişiklik `AuditLog`'a da yazılır (web `/admin/audit-log`, mobil "Denetim kaydı").

## Mağaza yayın bayrakları (`iosAppStoreLive`, `androidPlayLive`)

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
