-- Cift tahsilat (double-capture) yarisini kapatmak icin ara durum.
--
-- `PaymentService.markCaptured()` artik saglayiciya gitmeden once bu durumla
-- atomik bir hak aliyor (bkz. PaymentService.ts, 2026-09-10). Ayni transaction
-- icinde eklenen enum degeri kullanilamadigindan (bkz. 20260822090000_payment_status_values)
-- ekleme burada, kullanim ayri migrasyonda/kodda.

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CAPTURING' AFTER 'AUTHORIZED';
