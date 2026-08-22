-- Test/demo dükkanlarını kamuya açık yüzeylerden ayırma.
--
-- P1-4 (2026-08-22 denetimi): Türkiye'de bulunabilen üç dükkandan biri kişisel bir
-- test kaydıydı (`Furkan'ın Diğer Mekan`) ve gerçek partnerden ayırt edilemiyordu.
-- Genel aramanın tek filtresi `isActive = true AND latitude IS NOT NULL` idi.
--
-- `isActive = false` yapmak çözüm DEĞİLDİ: dükkanın 5 rezervasyonu var ve pasife
-- almak esnaf akışlarını bozuyor. Doğru ayrım "aktif mi" değil, "gerçek mi".

ALTER TABLE "Shop" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;

-- Mevcut dükkanlar BİLEREK işaretlenmiyor. Hangi kaydın test olduğu bir iş
-- bilgisidir; migrasyonun isimden tahmin etmesi ("Furkan" geçenler test olsun)
-- gerçek bir dükkanı canlı aramadan düşürebilirdi. İşaretleme /admin/partners
-- üzerinden yapılır.

CREATE INDEX "Shop_isTest_isActive_idx" ON "Shop"("isTest", "isActive");
