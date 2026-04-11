# Platform ayarları (merkezi iş kuralları)

Tek kaynak: Prisma `PlatformSettings` (`id = "default"`), okuma için [`getPricingRules()`](../src/lib/platform-settings.ts) (5 saniyelik bellek önbelleği).

## Yönetim arayüzü

Admin: **`/admin/platform-settings`** — tüm sayısal kurallar ve **platform tatil günleri** (`YYYY-MM-DD` listesi, JSON) form üzerinden güncellenir. Bu günlere denk gelen konaklama pencereleri yeni rezervasyonda reddedilir (`BOOKING_CALENDAR_TIMEZONE`, varsayılan `Europe/Istanbul`).

## Önbellek

`updatePlatformSettingsAction` kayıttan sonra `invalidatePricingRulesCache()` çağırır; yeni kurallar saniyeler içinde geçerlidir.

## Audit

`PlatformSettings.updatedAt` alanı son değişiklik zamanını tutar; admin ekranında gösterilir.
