import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { notificationService } from "@/services/NotificationService";
import { bookingEventService } from "@/services/BookingEventService";

/**
 * Uyuşmazlık (hasar / hırsızlık / diğer) açma — iki taşıyıcının ORTAK gövdesi.
 *
 * NEDEN SERVİSE TAŞINDI (2026-09-01'de ölçüldü): mobil uç
 * (`api/mobile/disputes`) yalnızca `prisma.dispute.create` yapıyordu. Web
 * action'ının yaptığı İKİ ŞEYİ birden atlıyordu:
 *
 *   - `bookingEventService.record({ event: "DISPUTED" })` — rezervasyonun
 *     zaman çizelgesinde hiçbir iz kalmıyordu
 *   - `notificationService.notifyAdminsForDispute(...)` — **HİÇ KİMSEYE HABER
 *     GİTMİYORDU**
 *
 * Yani mobil uygulamadan açılan bir HASAR ya da HIRSIZLIK şikâyeti, biri
 * `/admin/disputes` sayfasını açana kadar veritabanında sessizce bekliyordu.
 * Bir valiz emaneti platformunda bundan daha ağır bir operasyonel kusur azdır.
 *
 * CLAUDE.md'nin uyardığı sınıfın aynısı: "mobil 'reddet' iadeyi ve slot
 * temizliğini atlıyordu, mobil 'teslim aldım' mühürleri hiç atamıyordu."
 */

export type CreateDisputeInput = {
  bookingId: string;
  guestId: string;
  reason: "DAMAGE" | "THEFT" | "OTHER";
  description: string;
};

export type CreateDisputeResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not_found" | "not_owner" | "booking_not_ready" | "duplicate" };

/** Uyuşmazlık ancak valiz teslim alındıktan SONRA açılabilir. */
const DISPUTABLE_STATUSES = ["CHECKED_IN", "CHECKED_OUT"];

class DisputeService {
  async create(input: CreateDisputeInput): Promise<CreateDisputeResult> {
    const { bookingId, guestId, reason, description } = input;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, guestId: true, status: true },
    });
    if (!booking) return { ok: false, reason: "not_found" };
    /*
      SAHIPLIK: yalnizca rezervasyonun misafiri sikayet acabilir. `not_found` ile
      `not_owner` AYRI donuyor cunku cagiranlarin biri 404, digeri 403 uretiyor.
    */
    if (booking.guestId !== guestId) return { ok: false, reason: "not_owner" };
    if (!DISPUTABLE_STATUSES.includes(booking.status)) {
      return { ok: false, reason: "booking_not_ready" };
    }

    const existing = await prisma.dispute.findUnique({ where: { bookingId } });
    if (existing) return { ok: false, reason: "duplicate" };

    let dispute;
    try {
      dispute = await prisma.dispute.create({
        data: { bookingId, reason, description, status: "OPEN" },
      });
    } catch (e: unknown) {
      // `Dispute.bookingId` @unique -- yarista ikinci istek buraya duser.
      if ((e as { code?: string })?.code === "P2002") {
        return { ok: false, reason: "duplicate" };
      }
      throw e;
    }

    /*
      Iz ve bildirim ATESLE-UNUT: sikayetin KAYDEDILMESI, bildiriminin
      gonderilmesine bagli olmamali -- bildirim saglayicisi dususe gecerse
      misafirin sikayeti kaybolmamali. `.catch` ZORUNLU: yakalanmamis red
      Node'da sureci dusurur (`unhandled-rejection` mandali, tavan 0).
    */
    void bookingEventService
      .record({
        bookingId,
        event: "DISPUTED",
        actorId: guestId,
        actorRole: "GUEST",
        metadata: { reason, description },
      })
      .catch((err) => logger.error({ err, bookingId }, "booking_event_disputed_failed"));

    void notificationService
      .notifyAdminsForDispute({ bookingId, reason })
      .catch((err) => logger.error({ err, bookingId }, "notify_admins_dispute_failed"));

    return { ok: true, id: dispute.id };
  }
}

export const disputeService = new DisputeService();
