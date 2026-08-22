import prisma from "@/lib/db";
import logger from "@/lib/logger";

/**
 * Mühür envanteri bütünlük denetimi.
 *
 * NEDEN VAR: 2026-08-22'de 1.277 mührün **1.247'si** `ASSIGNED` ama hiçbir dükkana
 * bağlı değildi (`shopId IS NULL`) ve `BookingSeal` tablosu 3 `CHECKED_IN`
 * rezervasyona rağmen tamamen boştu. İkisi de aylardır böyleydi ve hiçbir yerde
 * görünmüyordu (P1-7).
 *
 * Mühür, anlaşmazlıkta fiziksel zilyetliğin kanıtıdır: "bu bavul mühürlü teslim
 * alındı, mühür numarası şu, çıkışta aynı mühür sağlamdı". Envanter bozuksa bu
 * zincir kurulamaz — yani bu bir raporlama sorunu değil, ürünün temel güvence
 * vaadinin sorunudur.
 *
 * Bu servis SALT OKUNURDUR. Onarım ayrı ve bilinçli bir adımdır
 * (`scripts/repair-seal-ownership.sh`, varsayılanı kuru çalışma).
 */

export type SealIntegrityReport = {
  checkedAt: string;
  /** `STOCK` dışında olup hiçbir dükkana ait olmayan mühür sayısı. DB kısıtı bunu artık engelliyor. */
  orphanedNonStock: number;
  /** `STOCK` olduğu hâlde bir dükkana bağlı görünen mühür sayısı. */
  stockWithShop: number;
  /** Toplam mühür. */
  total: number;
  byStatus: Record<string, number>;
  /**
   * Bavula mühür kaydedilmemiş `CHECKED_IN` rezervasyon sayısı.
   * Sıfırdan büyükse: bavul dükkanda ama hangi mühürle mühürlendiği kayıtlı değil.
   */
  checkedInWithoutSeals: number;
  /** `ok` = değişmez korunuyor. `broken` = geçersiz satır var. */
  status: "ok" | "broken";
};

export class SealIntegrityService {
  async check(now: Date = new Date()): Promise<SealIntegrityReport> {
    const [orphanedNonStock, stockWithShop, total, grouped, checkedInWithoutSeals] =
      await Promise.all([
        prisma.seal.count({
          where: { status: { not: "STOCK" }, shopId: null },
        }),
        prisma.seal.count({
          where: { status: "STOCK", shopId: { not: null } },
        }),
        prisma.seal.count(),
        prisma.seal.groupBy({ by: ["status"], _count: { serialNumber: true } }),
        prisma.booking.count({
          where: { status: "CHECKED_IN", seals: { none: {} } },
        }),
      ]);

    const byStatus: Record<string, number> = {};
    for (const g of grouped) byStatus[g.status] = g._count.serialNumber;

    const report: SealIntegrityReport = {
      checkedAt: now.toISOString(),
      orphanedNonStock,
      stockWithShop,
      total,
      byStatus,
      checkedInWithoutSeals,
      status: orphanedNonStock > 0 || stockWithShop > 0 ? "broken" : "ok",
    };

    if (report.status === "broken") {
      logger.warn(
        { orphanedNonStock, stockWithShop, total },
        "seal_integrity_broken",
      );
    }

    return report;
  }
}

export const sealIntegrityService = new SealIntegrityService();
