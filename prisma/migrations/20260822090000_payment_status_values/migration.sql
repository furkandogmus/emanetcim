-- Ödeme defteri: yeni durum değerleri.
--
-- AYRI MİGRASYON OLMASININ SEBEBİ: PostgreSQL, bir enum'a aynı transaction
-- içinde eklenen değeri o transaction'da KULLANMAYA izin vermez
-- ("unsafe use of new value of enum type"). Prisma her migrasyon dosyasını
-- kendi transaction'ında çalıştırdığı için değerleri burada ekleyip
-- varsayılanı bir sonraki migrasyonda değiştiriyoruz.

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'AUTHORIZED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
