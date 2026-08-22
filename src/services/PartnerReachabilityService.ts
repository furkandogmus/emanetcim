import prisma from "@/lib/db";
import logger from "@/lib/logger";

/**
 * Partner ulaşılabilirlik denetimi.
 *
 * NEDEN VAR: 2026-08-22'de prod'daki **3 PARTNER hesabının 2'sinin e-postası
 * yoktu** ve ikisi de canlı bir dükkan sahibiydi. `approveShop` onay bildirimini
 * `if (partnerEmail)` ile **sessizce** atlıyordu; SMS dalı çalıştığı için sorun
 * hiç görünmedi (P1-3).
 *
 * Asıl risk e-postanın yokluğu değil — esnaf girişi telefon tabanlı tasarlanmış,
 * yani e-postasız partner bir bozulma değil tasarımın sonucu (P1-16). Asıl risk
 * **hiçbir kanalı olmayan** partnerdir: dükkanı rezervasyon alıyor ama sahibine
 * ulaşılamıyor. Bir rezervasyon geldiğinde, bir anlaşmazlık çıktığında veya
 * hesabı askıya alınacağında kimse haber veremez.
 *
 * SALT OKUNURDUR.
 */

export type PartnerReachabilityReport = {
  checkedAt: string;
  totalPartners: number;
  /** Ne e-postası ne telefonu olan partner. Bu bir açıktır. */
  unreachable: number;
  /** Yalnızca telefonu olan. Tasarım gereği normaldir, bilgi amaçlı. */
  phoneOnly: number;
  /** Yalnızca e-postası olan. */
  emailOnly: number;
  /**
   * Ulaşılamaz partnerlerden AKTİF dükkanı olanların sayısı.
   * Sıfırdan büyükse: rezervasyon alan ama sahibine ulaşılamayan dükkan var.
   */
  unreachableWithActiveShop: number;
  status: "ok" | "broken";
};

export class PartnerReachabilityService {
  async check(now: Date = new Date()): Promise<PartnerReachabilityReport> {
    const partnerBase = { role: "PARTNER" as const };
    const noEmail = { OR: [{ email: null }, { email: "" }] };
    const noPhone = { OR: [{ phone: null }, { phone: "" }] };

    const [totalPartners, unreachable, phoneOnly, emailOnly, unreachableWithActiveShop] =
      await Promise.all([
        prisma.user.count({ where: partnerBase }),
        prisma.user.count({ where: { ...partnerBase, AND: [noEmail, noPhone] } }),
        prisma.user.count({
          where: { ...partnerBase, AND: [noEmail, { NOT: noPhone }] },
        }),
        prisma.user.count({
          where: { ...partnerBase, AND: [{ NOT: noEmail }, noPhone] },
        }),
        prisma.user.count({
          where: {
            ...partnerBase,
            AND: [noEmail, noPhone],
            shops: { some: { isActive: true } },
          },
        }),
      ]);

    const report: PartnerReachabilityReport = {
      checkedAt: now.toISOString(),
      totalPartners,
      unreachable,
      phoneOnly,
      emailOnly,
      unreachableWithActiveShop,
      // Ulaşılamaz bir partner her zaman sorundur; aktif dükkanı varsa acildir.
      status: unreachable > 0 ? "broken" : "ok",
    };

    if (report.status === "broken") {
      logger.warn(
        { unreachable, unreachableWithActiveShop, totalPartners },
        "partner_reachability_broken",
      );
    }

    return report;
  }
}

export const partnerReachabilityService = new PartnerReachabilityService();
