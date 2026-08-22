-- Ödeme defteri: denetlenebilir alanlar + güvenli varsayılan.
--
-- P0-0 (2026-08-22 denetimi): sağlayıcı entegre değilken `status` varsayılanı
-- `SUCCESS` idi; hiçbir kart çekilmeden "başarılı" ödeme kaydı üretiliyordu.
-- Varsayılan `PENDING` oluyor.
--
-- MEVCUT SATIRLARA DOKUNULMUYOR. Prod'daki 12 `SUCCESS` kaydının karşılığı olan
-- para yok, ama bunlar backlog'da P1-5 olarak ayrı bir soruşturmanın konusu;
-- migrasyonun sessizce veri düzeltmesi yapması denetim izini bozardı.
-- Yeni satırların hangi sağlayıcıdan geldiği ayırt edilebilsin diye eski
-- satırlar 'legacy_unverified' olarak damgalanıyor.

ALTER TABLE "PaymentLog"
  ADD COLUMN "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "currency"       TEXT          NOT NULL DEFAULT 'TRY',
  ADD COLUMN "provider"       TEXT          NOT NULL DEFAULT 'manual',
  ADD COLUMN "providerRef"    TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "failureReason"  TEXT,
  ADD COLUMN "capturedAt"     TIMESTAMP(3),
  ADD COLUMN "refundedAt"     TIMESTAMP(3),
  ADD COLUMN "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Varsayilan YALNIZCA mevcut satirlari doldurmak icindi; kaldiriliyor.
-- Prisma'nin `@updatedAt` alani degeri istemci tarafinda uretir ve sutunda bir
-- DB varsayilani BEKLEMEZ. Birakilirsa sema ile migrasyon ayrisir:
-- `prisma migrate diff` bunu "default changed" olarak raporluyordu.
ALTER TABLE "PaymentLog" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Bu migrasyondan ÖNCE var olan satırlar sağlayıcısı doğrulanmamış kayıtlardır.
UPDATE "PaymentLog" SET "provider" = 'legacy_unverified';

-- Zaten SUCCESS olan eski satırların tahsilat zamanı bilinmiyor; kayıt zamanını
-- kullanmak yanlış olurdu, o yüzden NULL bırakılıyor (bilinmiyor = NULL).

ALTER TABLE "PaymentLog" ALTER COLUMN "status" SET DEFAULT 'PENDING';

CREATE UNIQUE INDEX "PaymentLog_idempotencyKey_key" ON "PaymentLog"("idempotencyKey");
CREATE INDEX "PaymentLog_provider_status_idx" ON "PaymentLog"("provider", "status");
