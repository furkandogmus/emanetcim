-- Test/ekip hesaplarını gerçek kullanıcılardan ayırmak için; mevcut kayıtlar false kalır.
ALTER TABLE "User" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;
