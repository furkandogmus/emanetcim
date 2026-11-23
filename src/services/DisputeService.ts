import { DISPUTE_ADMIN_NOTE_MAX, DISPUTE_INITIAL_STATUS, DISPUTE_STATUSES, type DisputeStatus } from "@/lib/dispute-status";
import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { writeAuditLog } from "@/lib/audit-log";
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

export type DisputeAdminActor = { id: string; role: string };

export type UpdateDisputeStatusResult =
  | { ok: true; status: DisputeStatus; adminNote: string | null }
  | { ok: false; reason: "invalid_status" | "note_too_long" | "not_found" };


const ADMIN_DISPUTE_INCLUDE = {
  booking: {
    select: {
      id: true,
      totalPrice: true,
      checkInTime: true,
      checkOutTime: true,
      status: true,
      guest: { select: { name: true, email: true } },
      shop: { select: { name: true } },
      // Muhur fotografi uyusmazligin kaniti; bakan kisi onu gormeli.
      seals: {
        select: { id: true, sealNumber: true, bagIndex: true, bagSize: true, photoUrl: true },
        orderBy: { bagIndex: "asc" as const },
      },
    },
  },
} as const;

class DisputeService {
  /** Yonetici listesi (web `/admin/disputes` ve mobil uc ayni sorgu). `status` taninmazsa filtresiz. */
  listForAdmin(status?: string | null) {
    const where = DISPUTE_STATUSES.includes(status as DisputeStatus) ? { status: status as DisputeStatus } : {};
    return prisma.dispute.findMany({ where, orderBy: { createdAt: "desc" }, include: ADMIN_DISPUTE_INCLUDE });
  }

  getForAdmin(id: string) {
    return prisma.dispute.findUnique({ where: { id }, include: ADMIN_DISPUTE_INCLUDE });
  }

  /**
   * Yonetici durum + not gunceller. Web'deki kural aynen: dort durumdan herhangi
   * birine gecilebilir, bos not `null`. Misafire bildirim ve iade YOK; web de
   * yapmiyor, mobil yeni bir yan etki uretmesin.
   */
  async updateStatus(
    actor: DisputeAdminActor,
    disputeId: string,
    statusRaw: unknown,
    adminNoteRaw: unknown,
    ctx: { ip?: string | null } = {},
  ): Promise<UpdateDisputeStatusResult> {
    if (typeof statusRaw !== "string" || !DISPUTE_STATUSES.includes(statusRaw as DisputeStatus)) {
      return { ok: false, reason: "invalid_status" };
    }
    const status = statusRaw as DisputeStatus;
    const adminNote = typeof adminNoteRaw === "string" ? adminNoteRaw.trim() || null : null;
    if (adminNote !== null && adminNote.length > DISPUTE_ADMIN_NOTE_MAX) return { ok: false, reason: "note_too_long" };

    const existing = await prisma.dispute.findUnique({ where: { id: disputeId }, select: { status: true } });
    if (!existing) return { ok: false, reason: "not_found" };

    await prisma.dispute.update({ where: { id: disputeId }, data: { status, adminNote } });
    writeAuditLog({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: "dispute.update_status",
      entityType: "Dispute",
      entityId: disputeId,
      metadata: { from: existing.status, to: status, hasNote: adminNote !== null },
      ip: ctx.ip ?? null,
    });
    return { ok: true, status, adminNote };
  }

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
        data: { bookingId, reason, description, status: DISPUTE_INITIAL_STATUS },
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
      .notifyAdminsForDispute({ bookingId, reason, disputeId: dispute.id })
      .catch((err) => logger.error({ err, bookingId }, "notify_admins_dispute_failed"));

    return { ok: true, id: dispute.id };
  }
}

export const disputeService = new DisputeService();
