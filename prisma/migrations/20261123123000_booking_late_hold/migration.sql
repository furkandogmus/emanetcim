-- Gec birakma: esnafin "Misafiri bekle" ile uzattigi otomatik kapanis ani.
-- Bos (nullable) sutun ekler; mevcut satirlar NULL kalir (bekletme yok). Yalnizca ekleme.
-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "lateHoldUntil" TIMESTAMP(3);
