# Platform ayarları (merkezi iş kuralları)

Tek kaynak: Prisma `PlatformSettings` (`id = "default"`), okuma için [`getPricingRules()`](../src/lib/platform-settings.ts) (5 saniyelik bellek önbelleği).

## Yönetim arayüzü

Admin: **`/admin/platform-settings`** — tüm sayısal kurallar ve **platform tatil günleri** (`YYYY-MM-DD` listesi, JSON) form üzerinden güncellenir. Bu günlere denk gelen konaklama pencereleri yeni rezervasyonda reddedilir (`BOOKING_CALENDAR_TIMEZONE`, varsayılan `Europe/Istanbul`).

## Önbellek

`updatePlatformSettingsAction` kayıttan sonra `invalidatePricingRulesCache()` çağırır; yeni kurallar saniyeler içinde geçerlidir.

## Audit

`PlatformSettings.updatedAt` alanı son değişiklik zamanını tutar; admin ekranında gösterilir.

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
