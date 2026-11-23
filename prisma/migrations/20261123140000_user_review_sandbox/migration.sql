-- Inceleme (App Review) hesabi bayragi. Varsayilan false: mevcut hesaplarin davranisi degismez. Yalnizca ekleme.
-- AlterTable
ALTER TABLE "User" ADD COLUMN "reviewSandbox" BOOLEAN NOT NULL DEFAULT false;
