-- User modeli: schema.prisma ile uyum (admin IP / ban)

ALTER TABLE "User" ADD COLUMN "isBanned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "lastIp" TEXT;
