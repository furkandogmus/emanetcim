-- Fiyatlandırma: kural anlık kopyası + gecikme ücretinin kendi alanı.
--
-- P0-3/P0-4/P0-5 (2026-08-22 denetimi) üç ayrı belirtiydi, altlarında tek bir
-- mimari yanlış vardı: fiyat kuralları TEK SATIRLIK ve SÜRÜMSÜZ bir global ayar.
-- Sonuçları: (a) admin bir çarpanı değiştirince geçmiş tahsilatlar yeniden
-- üretilemez oluyordu, (b) gecikme ücreti iptal ücreti alanını ödünç alıyordu,
-- (c) şema/kod/canlı satır varsayılanları üç farklı değerdeydi.

-- (a) Rezervasyonun fiyatını üreten kuralların anlık kopyası. Yalnızca yaratılışta
--     yazılır, sonra değişmez. Eski satırlarda NULL kalır: o rezervasyonlar için
--     hangi kuralın geçerli olduğu GERÇEKTEN bilinmiyor ve uydurmak yanlış olurdu.
ALTER TABLE "Booking" ADD COLUMN "pricingSnapshot" JSONB;

-- (b) Gecikme ücreti artık kendi alanında. Mevcut satırda `cancelFixedFeeTry`
--     hangi değerse gecikme ücreti de o kabul ediliyor — davranış aynen korunuyor,
--     yalnızca alanlar ayrılıyor. Bundan sonra ikisi bağımsız değiştirilebilir.
ALTER TABLE "PlatformSettings"
  ADD COLUMN "latePickupFeeTry"   DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "latePickupGraceMin" INTEGER       NOT NULL DEFAULT 15;

UPDATE "PlatformSettings" SET "latePickupFeeTry" = "cancelFixedFeeTry";

-- (c) Şema varsayılanları `DEFAULT_PRICING_RULES` ile hizalanıyor.
--     DİKKAT: bu yalnızca YENİ satırların varsayılanıdır. Prod'daki mevcut
--     "default" satırına BİLEREK dokunulmuyor — canlı fiyatı bir migrasyonun
--     sessizce değiştirmesi kabul edilemez, bu bir iş kararıdır ve
--     /admin/platform-settings üzerinden verilmelidir (P0-3).
ALTER TABLE "PlatformSettings"
  ALTER COLUMN "insuranceFeeTry"   SET DEFAULT 0,
  ALTER COLUMN "earlyRefundRatio"  SET DEFAULT 1.0,
  ALTER COLUMN "cancelFixedFeeTry" SET DEFAULT 0,
  ALTER COLUMN "bagMultiplierS"    SET DEFAULT 0.8,
  ALTER COLUMN "bagMultiplierM"    SET DEFAULT 1.0,
  ALTER COLUMN "bagMultiplierXl"   SET DEFAULT 1.5;
