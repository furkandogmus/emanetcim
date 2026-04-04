# Platform ayarları (merkezi iş kuralları)

Tek kaynak: Prisma `PlatformSettings` (`id = "default"`), okuma için [`getPricingRules()`](../src/lib/platform-settings.ts) (5 saniyelik bellek önbelleği).

## Yönetim arayüzü

Admin: **`/admin/platform-settings`** — tüm sayısal kurallar form üzerinden güncellenir.

## Önbellek

`updatePlatformSettingsAction` kayıttan sonra `invalidatePricingRulesCache()` çağırır; yeni kurallar saniyeler içinde geçerlidir.

## Audit

`PlatformSettings.updatedAt` alanı son değişiklik zamanını tutar; admin ekranında gösterilir.
