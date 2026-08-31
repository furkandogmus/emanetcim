import prisma from "@/lib/db";
import { computeSplit, EARNING_BOOKING_STATUSES } from "@/lib/platform-split";
import { moneyToNumber } from "@/lib/money";
import { dayRangeInTimeZone, monthRangeInTimeZone } from "@/lib/timezone";
import { safeTimezone } from "@/services/PartnerEarningsService";

/**
 * Esnaf panelinin GÜNLÜK enstantanesi.
 *
 * NEDEN VAR: panel yalnızca ömür boyu toplamları gösteriyordu — aktif
 * rezervasyon sayısı, toplam kazanç, aylık görüntülenme. Esnafın dükkanı
 * açtığında sorduğu soru bunların hiçbiri değil:
 *
 *   "Bugün kaç valiz gelecek? Kaç tanesi alınacak? Elimde şu an kaç valiz var?
 *    Bu ay geçen aya göre nasıl gidiyor?"
 *
 * Hiçbirinin cevabı ekranda yoktu. Panel bilgi veriyordu ama GÜNÜ
 * planlatmıyordu.
 *
 * Bütün zaman sınırları DÜKKANIN saat diliminde (`src/lib/timezone.ts`).
 * Sunucunun dilimiyle hesaplamak, UTC konteynerde "bugün"ü 03:00'te başlatır.
 */

export type PartnerDashboardSnapshot = {
  /** Bugün gelmesi beklenen (ödenmiş, henüz teslim alınmamış) rezervasyonlar. */
  todayArrivals: number;
  /** Bugün teslim edilmesi beklenen (elde duran) rezervasyonlar. */
  todayPickups: number;
  /** ŞU AN dükkanda duran valiz adedi — rezervasyon değil, valiz. */
  bagsInStorage: number;
  /** Bu ayın esnaf payı. */
  monthNet: number;
  /** Geçen ayın esnaf payı — karşılaştırma için. */
  prevMonthNet: number;
  /**
   * Geçen aya göre yüzde değişim. Geçen ay 0 ise `null` —
   * sıfıra bölmek "%∞ artış" gibi anlamsız bir rakam üretir.
   */
  monthChangePct: number | null;
  /** Bugüne kadar teslim edilmiş toplam valiz — kilometre taşı için. */
  bagsHandledAllTime: number;
};

/** Bir rezervasyonun taşıdığı valiz adedi. Üç boy tek sayıya iner. */
const BAG_SUM = { bagCountS: true, bagCountM: true, bagCountXl: true } as const;

class PartnerDashboardService {
  async getSnapshot(
    shopId: string,
    timezone: string | null | undefined,
    commissionRate: number,
    now: Date = new Date(),
  ): Promise<PartnerDashboardSnapshot> {
    const tz = safeTimezone(timezone);
    const today = dayRangeInTimeZone(tz, now);
    const thisMonth = monthRangeInTimeZone(tz, now, 0);
    const lastMonth = monthRangeInTimeZone(tz, now, 1);

    const earning = { in: [...EARNING_BOOKING_STATUSES] };

    const [arrivals, pickups, inStorage, monthAgg, prevAgg, handled] =
      await Promise.all([
        // Bugun GELECEK: odenmis ama henuz teslim alinmamis.
        prisma.booking.count({
          where: {
            shopId,
            status: "PAID",
            checkInTime: { gte: today.start, lt: today.end },
          },
        }),
        // Bugun ALINACAK: elde duran ve cikis saati bugune denk gelen.
        prisma.booking.count({
          where: {
            shopId,
            status: "CHECKED_IN",
            checkOutTime: { gte: today.start, lt: today.end },
          },
        }),
        /*
          SU AN elde duran valiz. Cikis saati gecmis olsa bile teslim
          EDILMEDIYSE hala dukkanda duruyor -- bu yuzden olcu `CHECKED_IN`
          durumu, tarih degil. Esnafin rafina bakinca saydigi sayi bu.
        */
        prisma.booking.aggregate({
          where: { shopId, status: "CHECKED_IN" },
          _sum: BAG_SUM,
        }),
        prisma.booking.aggregate({
          where: {
            shopId,
            status: earning,
            createdAt: { gte: thisMonth.start, lt: thisMonth.end },
          },
          _sum: { totalPrice: true },
        }),
        prisma.booking.aggregate({
          where: {
            shopId,
            status: earning,
            createdAt: { gte: lastMonth.start, lt: lastMonth.end },
          },
          _sum: { totalPrice: true },
        }),
        prisma.booking.aggregate({
          where: { shopId, status: "CHECKED_OUT" },
          _sum: BAG_SUM,
        }),
      ]);

    const sumBags = (s: {
      bagCountS: number | null;
      bagCountM: number | null;
      bagCountXl: number | null;
    }) => (s.bagCountS ?? 0) + (s.bagCountM ?? 0) + (s.bagCountXl ?? 0);

    const monthNet = computeSplit(
      moneyToNumber(monthAgg._sum.totalPrice),
      commissionRate,
    ).merchantAmount;
    const prevMonthNet = computeSplit(
      moneyToNumber(prevAgg._sum.totalPrice),
      commissionRate,
    ).merchantAmount;

    return {
      todayArrivals: arrivals,
      todayPickups: pickups,
      bagsInStorage: sumBags(inStorage._sum),
      monthNet,
      prevMonthNet,
      monthChangePct:
        prevMonthNet > 0
          ? Math.round(((monthNet - prevMonthNet) / prevMonthNet) * 100)
          : null,
      bagsHandledAllTime: sumBags(handled._sum),
    };
  }
}

export const partnerDashboardService = new PartnerDashboardService();
