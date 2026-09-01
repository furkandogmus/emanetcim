-- Kupon indirimi artik rezervasyonda KAYITLI.
--
-- NEDEN: kupon `totalPrice`i dogrudan dusuruyordu ve bunun deftere hicbir izi
-- kalmiyordu. "Bu rezervasyon neden 50 degil de 40 TRY?" sorusunun cevabi
-- veride yoktu. Referans indirimi (`referralDiscountAmount`) ta bastan
-- kaydediliyordu; ayni olay bir yolda denetlenebilir, digerinde gorunmezdi.
--
-- Iki kolon da NULLABLE/DEFAULT: mevcut satirlar degismez. Gecmis kuponlu
-- rezervasyonlarin indirimi geriye donuk BILINEMEZ -- veri hic yazilmadi.
ALTER TABLE "Booking" ADD COLUMN "couponDiscountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "couponCode" TEXT;
