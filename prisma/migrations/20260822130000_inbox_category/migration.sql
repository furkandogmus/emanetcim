-- Gelen kutusu sınıflandırması.
--
-- P1-18 (2026-08-22 denetimi): `destek@bagajpark.com`'a gelen HER e-posta
-- sınıflandırılmadan `ContactMessage` olarak yazılıyordu. Kutuda 67 mesaj vardı,
-- 57'si okunmamış, ezici çoğunluğu soğuk pazarlama. Gerçek bir misafir şikâyeti
-- bunların arasında kaybolur — destek kanalının kendisi çalışmıyor demektir.

ALTER TABLE "ContactMessage"
  ADD COLUMN "category"       TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
  ADD COLUMN "categoryReason" TEXT;

-- Mevcut satırlar `UNCLASSIFIED` kalıyor ve SQL ile tahmin EDİLMİYOR.
-- Sınıflandırma başlıklara bakıyor (`List-Unsubscribe`, `Auto-Submitted`) ve o
-- başlıklar `raw` JSON'unun içinde; SQL'de yeniden uygulamak, kuralın ikinci bir
-- kopyası olurdu. Geçmiş satırları `/api/internal/classify-inbox` işi
-- sınıflandırır — aynı kodu kullanır, idempotenttir.

CREATE INDEX "ContactMessage_category_isRead_createdAt_idx"
  ON "ContactMessage"("category", "isRead", "createdAt");
