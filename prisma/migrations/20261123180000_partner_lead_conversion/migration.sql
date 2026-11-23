-- AlterTable
ALTER TABLE "PartnerLead" ADD COLUMN     "convertedAt" TIMESTAMP(3),
ADD COLUMN     "convertedById" TEXT,
ADD COLUMN     "convertedShopId" TEXT,
ADD COLUMN     "convertedUserId" TEXT;

-- AddForeignKey
ALTER TABLE "PartnerLead" ADD CONSTRAINT "PartnerLead_convertedById_fkey" FOREIGN KEY ("convertedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerLead" ADD CONSTRAINT "PartnerLead_convertedUserId_fkey" FOREIGN KEY ("convertedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerLead" ADD CONSTRAINT "PartnerLead_convertedShopId_fkey" FOREIGN KEY ("convertedShopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
