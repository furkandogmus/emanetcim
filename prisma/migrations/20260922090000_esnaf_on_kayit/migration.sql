-- Esnaf on kaydi (/esnaf sayfasi). Hesap acmadan ad, telefon, adres birakilir;
-- ekip arayip dukkani kendisi acar. Yeni tablo, mevcut veriye dokunmaz.
CREATE TABLE "PartnerLead" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "shopName" TEXT,
    "address" TEXT NOT NULL,
    "locale" TEXT,
    "source" TEXT NOT NULL DEFAULT 'web',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "contactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerLead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartnerLead_phone_idx" ON "PartnerLead"("phone");

CREATE INDEX "PartnerLead_status_createdAt_idx" ON "PartnerLead"("status", "createdAt");
