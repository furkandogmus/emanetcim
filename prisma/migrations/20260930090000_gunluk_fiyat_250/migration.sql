-- Gunluk fiyat 150 -> 250 TL; yalnizca 150 olanlar, esnafin ozel fiyatlari korunur.
UPDATE o yuzden prod'da bos gecer,
-- 150'de kalmis baska bir ortam icin duruyor.
--
-- YALNIZCA 150 OLANLAR degisir: esnafin panelden bilincli girdigi fiyatlara ve
-- mevcut rezervasyonlarin `totalPrice`'ina dokunulmaz.
UPDATE "Shop" SET "pricePerDay" = 250 WHERE "pricePerDay" = 150;
UPDATE "PlatformSettings" SET "defaultPricePerDay" = 250 WHERE "defaultPricePerDay" = 150;

ALTER TABLE "Shop" ALTER COLUMN "pricePerDay" SET DEFAULT 250;
ALTER TABLE "PlatformSettings" ALTER COLUMN "defaultPricePerDay" SET DEFAULT 250;
