-- Esnaf-esnaf davet atfı: yeni bir esnaf başvurusu hangi esnafın davet
-- linkiyle geldiyse burada tutuluyor. İlişki (FK) bilinçli olarak yok --
-- davet eden hesap silinse de bu atıf kaydı kalmalı, davet edenin
-- User.referralCode'u üzerinden aranır.
--
-- Otomatik bir ödül (komisyon indirimi, kredi vb.) YOK -- bu ayrı bir iş
-- kararı. Şimdilik yalnızca atıf toplanıyor.

ALTER TABLE "User" ADD COLUMN "referredByPartnerId" TEXT;
