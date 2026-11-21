import prisma from "@/lib/db";
import {
  LEGAL_DOC_PRIVACY,
  LEGAL_DOC_TERMS,
  getLegalDocumentVersion,
} from "@/lib/legal-versions";

/**
 * Mobil kodla acilan hesap icin sozlesme + gizlilik kabulunu yazar.
 *
 * Web kaydi (`actions/register.ts`) iki satiri hesapla birlikte yaziyor; mobilde
 * kod ile acilan hesabin hic kabul kaydi yoktu. Yalnizca istemci "kabul
 * edildi" derse cagrilir: giris ekraninda cumleyi hic gostermemis eski
 * surumler kabul kaydi uretmez.
 */
export async function recordMobileLegalAcceptance(userId: string, ip: string | null): Promise<void> {
  await prisma.legalAcceptance.createMany({
    data: [LEGAL_DOC_TERMS, LEGAL_DOC_PRIVACY].map((documentKey) => ({
      userId,
      documentKey,
      version: getLegalDocumentVersion(documentKey),
      ip,
    })),
  });
}
