-- Panelden destek cevabı (ContactReply) + gelen postanın Message-ID'si.
--
-- NEDEN: admin panelindeki "Yanıtla" yalnızca bir mailto: linkiydi — cevap adminin
-- KİŞİSEL posta kutusundan gidiyordu, destek adresinden değil; yazışma zinciri
-- başlığı yoktu ve panelde "bu mesaja cevap verildi mi" bilgisi tutulamıyordu.

ALTER TABLE "ContactMessage" ADD COLUMN "inboundMessageId" TEXT;

CREATE TABLE "ContactReply" (
    "id" TEXT NOT NULL,
    "contactMessageId" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "resendId" TEXT,
    "sentBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactReply_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContactReply_contactMessageId_createdAt_idx" ON "ContactReply"("contactMessageId", "createdAt");

ALTER TABLE "ContactReply" ADD CONSTRAINT "ContactReply_contactMessageId_fkey" FOREIGN KEY ("contactMessageId") REFERENCES "ContactMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
