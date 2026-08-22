import type { BookingStatus } from "@prisma/client";
import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { bookingEventService } from "./BookingEventService";

/**
 * Süre aşımı mutabakatı — yaşam döngüsünün sonlanmayan ucunu görünür kılar.
 *
 * NEDEN VAR: 2026-08-22 denetiminde prod'daki 19 rezervasyonun 18'i çıkış saatini
 * geçmiş hâlde AÇIKTI ve **hiçbiri hiç `CHECKED_OUT` olmamıştı** — `BookingEvent`'te
 * de sıfır `CHECKED_OUT` olayı vardı. Üç müşterinin bavulu Haziran'dan beri
 * "dükkanda" görünüyordu. Sebep bir hata değil, bir EKSİKLİKTİ: hiç tarama yoktu,
 * dolayısıyla kimse fark etmiyordu.
 *
 * TASARIM KARARI — BU İŞ DURUM DEĞİŞTİRMEZ.
 * Yalnızca tespit eder, `BookingEvent`'e iz bırakır ve rapor döner. Otomatik
 * `NO_SHOW` işaretlemek veya iptal etmek cazip ama yanlış olurdu:
 *   - `PAID` bir rezervasyonun durumu değişirse partner hakedişi değişir
 *     (`EARNING_BOOKING_STATUSES`), yani bir tarama işi sessizce para hareketi
 *     yaratmış olur.
 *   - Bavul gerçekten dükkanda olabilir; "no-show" demek fiziksel gerçeği
 *     bilmeden verilen bir karardır.
 * Karar operasyonundur; bu iş kararı MÜMKÜN kılar, yerine geçmez.
 *
 * İDEMPOTENT: aynı rezervasyon için aynı eşikte ikinci kez olay yazmaz.
 */

/** Çıkış saati geçtiği hâlde hâlâ açık sayılan durumlar. */
const OPEN_STATUSES: BookingStatus[] = [
  "PENDING",
  "WAITING_APPROVAL",
  "APPROVED",
  "PAID",
  "CHECKED_IN",
];

/**
 * Şiddet eşikleri (saat). Eşik atlandıkça yeni bir olay yazılır — böylece bir
 * rezervasyonun ne kadar süredir açık olduğu olay akışından okunabilir.
 */
export const OVERDUE_TIERS = [
  { hours: 24, tier: "day_1" },
  { hours: 72, tier: "day_3" },
  { hours: 168, tier: "week_1" },
  { hours: 720, tier: "month_1" },
] as const;

export type OverdueTier = (typeof OVERDUE_TIERS)[number]["tier"];

export type OverdueBooking = {
  bookingId: string;
  shopId: string;
  status: BookingStatus;
  scheduledCheckOut: string;
  overdueHours: number;
  tier: OverdueTier;
  /** Bavul fiziksel olarak dükkanda mı? Yalnızca CHECKED_IN için true. */
  bagsInShop: boolean;
};

export type OverdueScanReport = {
  scannedAt: string;
  /** Çıkış saati geçmiş ve hâlâ açık toplam rezervasyon. */
  overdueCount: number;
  /** Bunlardan kaçında bavul hâlâ dükkanda (CHECKED_IN). */
  bagsInShopCount: number;
  byTier: Record<OverdueTier, number>;
  /** Yeni yazılan olay sayısı (idempotent: aynı eşik iki kez yazılmaz). */
  eventsRecorded: number;
  /** En eski açık rezervasyonun gecikmesi (saat). Yoksa 0. */
  oldestOverdueHours: number;
  items: OverdueBooking[];
};

const MS_PER_HOUR = 60 * 60 * 1000;

function tierFor(overdueHours: number): OverdueTier | null {
  let matched: OverdueTier | null = null;
  for (const t of OVERDUE_TIERS) {
    if (overdueHours >= t.hours) matched = t.tier;
  }
  return matched;
}

export class OverdueBookingService {
  /**
   * Süre aşımı taraması.
   *
   * @param opts.limit Rapora alınacak azami kayıt. Sayımlar limitten ETKİLENMEZ —
   *   `overdueCount` her zaman gerçek toplamdır. Sessiz kırpma, "hepsini gördük"
   *   izlenimi verir ki bu tam olarak bu işin engellemesi gereken şey.
   * @param opts.recordEvents false ise yalnızca okur (sağlık ucu bunu kullanır).
   */
  async scan(opts?: {
    now?: Date;
    limit?: number;
    recordEvents?: boolean;
  }): Promise<OverdueScanReport> {
    const now = opts?.now ?? new Date();
    const limit = opts?.limit ?? 200;
    const recordEvents = opts?.recordEvents ?? true;

    const [overdueCount, rows] = await Promise.all([
      prisma.booking.count({
        where: { status: { in: OPEN_STATUSES }, checkOutTime: { lt: now } },
      }),
      prisma.booking.findMany({
        where: { status: { in: OPEN_STATUSES }, checkOutTime: { lt: now } },
        select: {
          id: true,
          shopId: true,
          status: true,
          checkOutTime: true,
        },
        orderBy: { checkOutTime: "asc" },
        take: limit,
      }),
    ]);

    const byTier: Record<OverdueTier, number> = {
      day_1: 0,
      day_3: 0,
      week_1: 0,
      month_1: 0,
    };
    const items: OverdueBooking[] = [];
    let bagsInShopCount = 0;
    let oldestOverdueHours = 0;

    for (const row of rows) {
      const overdueHours = Math.floor(
        (now.getTime() - row.checkOutTime.getTime()) / MS_PER_HOUR,
      );
      const tier = tierFor(overdueHours);
      if (!tier) continue; // 24 saatin altı: normal operasyon toleransı

      byTier[tier] += 1;
      if (overdueHours > oldestOverdueHours) oldestOverdueHours = overdueHours;
      const bagsInShop = row.status === "CHECKED_IN";
      if (bagsInShop) bagsInShopCount += 1;

      items.push({
        bookingId: row.id,
        shopId: row.shopId,
        status: row.status,
        scheduledCheckOut: row.checkOutTime.toISOString(),
        overdueHours,
        tier,
        bagsInShop,
      });
    }

    let eventsRecorded = 0;
    if (recordEvents && items.length > 0) {
      eventsRecorded = await this.recordEscalations(items);
    }

    const report: OverdueScanReport = {
      scannedAt: now.toISOString(),
      overdueCount,
      bagsInShopCount,
      byTier,
      eventsRecorded,
      oldestOverdueHours,
      items,
    };

    logger.info(
      {
        overdueCount,
        bagsInShopCount,
        oldestOverdueHours,
        eventsRecorded,
        reported: items.length,
        // Limit yüzünden rapora girmeyen kayıt varsa AÇIKÇA söyle.
        truncated: overdueCount > rows.length,
      },
      "overdue_booking_scan",
    );

    return report;
  }

  /**
   * Eşik atlayan rezervasyonlar için olay yazar.
   *
   * İdempotent: bir rezervasyon için aynı eşik daha önce yazıldıysa tekrar
   * yazılmaz. Aksi halde günlük çalışan bir iş, aynı rezervasyonu aylarca her gün
   * yeniden bildirir ve olay akışı kullanılamaz hale gelir.
   */
  private async recordEscalations(items: OverdueBooking[]): Promise<number> {
    const existing = await prisma.bookingEvent.findMany({
      where: {
        bookingId: { in: items.map((i) => i.bookingId) },
        event: "OVERDUE",
      },
      select: { bookingId: true, metadata: true },
    });

    const seen = new Set<string>();
    for (const e of existing) {
      const meta = e.metadata as { tier?: unknown } | null;
      if (meta && typeof meta.tier === "string") {
        seen.add(`${e.bookingId}:${meta.tier}`);
      }
    }

    let written = 0;
    for (const item of items) {
      if (seen.has(`${item.bookingId}:${item.tier}`)) continue;
      try {
        await bookingEventService.record({
          bookingId: item.bookingId,
          event: "OVERDUE",
          metadata: {
            tier: item.tier,
            overdueHours: item.overdueHours,
            statusAtScan: item.status,
            bagsInShop: item.bagsInShop,
            scheduledCheckOut: item.scheduledCheckOut,
          },
        });
        written += 1;
      } catch (err) {
        logger.error(
          { err, bookingId: item.bookingId, tier: item.tier },
          "overdue_event_record_failed",
        );
      }
    }
    return written;
  }
}

export const overdueBookingService = new OverdueBookingService();
