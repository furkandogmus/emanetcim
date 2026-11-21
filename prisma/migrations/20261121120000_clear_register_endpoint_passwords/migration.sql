-- Silinen /api/mobile/auth/register ucunun actigi hesaplarin sifresini temizler.
--
-- NEDEN: o uc, e-postayi sahibini KANITLAMADAN dogrulanmis sayip istenen sifreyi
-- kaydediyordu. Gercek sahip sonra e-posta koduyla ya da Google ile girince o
-- satiri devralir; saldirganin koydugu sifre calismaya devam ederdi. Uc
-- kaldirildi, ama onceden acilmis satirlar kaldi.
--
-- KAPSAM: yalnizca e-postali hesaplar (telefon hesaplari e-posta devralmasina
-- acik degil ve SMS olmadigi icin sifre tek giris yolu). Satirlar analitik
-- kaydindan bulunur (`user_signed_up`, kaynak `mobile_register`); analitik 90 gun
-- tutuldugu icin daha eski kayitlar bu betikle bulunamaz.
-- ETKI: sifre silinir, tokenVersion artar (acik oturumlar duser). Hesap sahibi
-- e-posta koduyla girer ya da "sifremi unuttum" ile yeni sifre koyar.
UPDATE "User"
SET "passwordHash" = NULL,
    "tokenVersion" = "tokenVersion" + 1
WHERE "email" IS NOT NULL
  AND "passwordHash" IS NOT NULL
  AND "id" IN (
    SELECT "userId"
    FROM "AnalyticsEvent"
    WHERE "name" = 'user_signed_up'
      AND "userId" IS NOT NULL
      AND "metadata"->>'source' = 'mobile_register'
  );
