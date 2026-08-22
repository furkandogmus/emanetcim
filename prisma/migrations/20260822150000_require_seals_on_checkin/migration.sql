-- Check-in'de mühür kaydını zorunlu kılabilme.
--
-- P1-23 (2026-08-22 denetimi): `BookingSeal` tablosu tamamen boştu, buna karşılık
-- 3 `CHECKED_IN` rezervasyon vardı. Üç bavul dükkanda ama hangi mühürle
-- mühürlendikleri hiçbir yerde kayıtlı değil. Mühür, anlaşmazlıkta fiziksel
-- zilyetliğin kanıtıdır: "bu bavul mühürlü teslim alındı, numarası şu, çıkışta
-- aynı mühür sağlamdı". Kaydı yoksa bu zincir kurulamaz.
--
-- VARSAYILAN `false` — bilinçli. Lansmanda esnafın elinde mühür olmayabilir ve
-- `true` yapmak check-in'i tamamen bloke eder. Envanter dağıtıldıktan sonra
-- admin panelinden açılır.

ALTER TABLE "PlatformSettings"
  ADD COLUMN "requireSealsOnCheckIn" BOOLEAN NOT NULL DEFAULT false;
