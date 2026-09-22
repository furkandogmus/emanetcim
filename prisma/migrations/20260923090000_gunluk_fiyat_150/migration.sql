-- Gunluk valiz fiyati 50 TL'den 150 TL'ye (urun sahibinin 2026-09-23 karari).
--
-- NEDEN MIGRASYON: fiyat metinde degil, her dukkanin `pricePerDay` satirinda ve
-- platform ayarinda duruyor; ikisi de 50 olarak olusmustu (sema varsayilani).
-- Elle SQL yerine migrasyon: degisiklik git'te iz birakir ve deploy ile gelir.
--
-- YALNIZCA 50 OLANLAR degisir. Esnafin panelden bilincli olarak farkli bir fiyat
-- girdigi dukkanlara dokunulmaz. Mevcut rezervasyonlarin `totalPrice`'i
-- olusturulduklari anki tutari tasir, etkilenmez.
UPDATE "Shop" SET "pricePerDay" = 150 WHERE "pricePerDay" = 50;
UPDATE "PlatformSettings" SET "defaultPricePerDay" = 150 WHERE "defaultPricePerDay" = 50;

ALTER TABLE "Shop" ALTER COLUMN "pricePerDay" SET DEFAULT 150;
ALTER TABLE "PlatformSettings" ALTER COLUMN "defaultPricePerDay" SET DEFAULT 150;
