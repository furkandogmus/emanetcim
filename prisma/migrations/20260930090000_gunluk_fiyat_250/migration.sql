-- Gunluk valiz fiyati 150 TL'den 250 TL'ye (urun sahibinin 2026-09-30 karari).
--
-- 2026-09-30 prod olcumu: 496 dukkanin tamami 150.00; platform ayari admin
-- panelinden zaten 250.00'ye cekilmis. Ikinci UPDATE o yuzden prod'da bos gecer,
-- 150'de kalmis baska bir ortam icin duruyor.
--
-- YALNIZCA 150 OLANLAR degisir: esnafin panelden bilincli girdigi fiyatlara ve
-- mevcut rezervasyonlarin `totalPrice`'ina dokunulmaz.
UPDATE "Shop" SET "pricePerDay" = 250 WHERE "pricePerDay" = 150;
UPDATE "PlatformSettings" SET "defaultPricePerDay" = 250 WHERE "defaultPricePerDay" = 150;

ALTER TABLE "Shop" ALTER COLUMN "pricePerDay" SET DEFAULT 250;
ALTER TABLE "PlatformSettings" ALTER COLUMN "defaultPricePerDay" SET DEFAULT 250;
