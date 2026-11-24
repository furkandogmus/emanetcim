import { DISPUTE_ADMIN_NOTE_MAX, DISPUTE_INITIAL_STATUS, DISPUTE_STATUSES, type DisputeStatus } from "@/lib/dispute-status";
import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { writeAuditLog } from "@/lib/audit-log";
import { notificationService } from "@/services/NotificationService";
import { bookingEventService } from "@/services/BookingEventService";
import { presignStoredImage } from "@/lib/storage/private-read";
import type { Prisma } from "@prisma/client";

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

/**
 * Misafire bildirilecek gecis (G34). Sonuc (cozuldu/kapandi) her degisimde gider;
 * "inceleniyor" yalnizca ilk kez, acik sikayetten alindiginda gider ki geri-ileri
 * oynanan bir durum misafiri bogmasin. Ayni duruma ya da tekrar "acik"a gecis sessiz.
 */
export function guestOutcomeStatus(from: string, to: DisputeStatus): Exclude<DisputeStatus, "OPEN"> | null {
  if (from === to || to === "OPEN") return null;
  if (to === "IN_REVIEW") return from === "OPEN" ? "IN_REVIEW" : null;
  return to;
}

type AdminDisputeRow = Prisma.DisputeGetPayload<{ include: typeof ADMIN_DISPUTE_INCLUDE }>;

/**
 * Muhur fotografi `seals/` altinda ve kova onu herkese acmiyor: kayitli adres 403 verir.
 * Yalniz yonetici yollari (web `/admin/disputes`, mobil admin uclari) bunu cagirir;
 * adres 5 dk'lik imzali GET'e cevrilir.
 */
async function withSignedSealPhotos(row: AdminDisputeRow): Promise<AdminDisputeRow> {
  const seals = await Promise.all(
    row.booking.seals.map(async (s) => ({ ...s, photoUrl: await presignStoredImage(s.photoUrl, "seals/") })),
  );
  return { ...row, booking: { ...row.booking, seals } };
}

class DisputeService {
  /** Yonetici listesi (web `/admin/disputes` ve mobil uc ayni sorgu). `status` taninmazsa filtresiz. */
  async listForAdmin(status?: string | null) {
    const where = DISPUTE_STATUSES.includes(status as DisputeStatus) ? { status: status as DisputeStatus } : {};
    const rows = await prisma.dispute.findMany({ where, orderBy: { createdAt: "desc" }, include: ADMIN_DISPUTE_INCLUDE });
    return Promise.all(rows.map(withSignedSealPhotos));
  }

  async getForAdmin(id: string) {
    const row = await prisma.dispute.findUnique({ where: { id }, include: ADMIN_DISPUTE_INCLUDE });
    return row ? withSignedSealPhotos(row) : null;
  }

  /**
   * Yonetici durum + not gunceller (web action ve mobil uc ayni govde). Dort durumdan
   * herhangi birine gecilebilir, bos not `null`. Iade YOK. Durum degistiyse misafire
   * bildirim gider (`guestOutcomeStatus`); not ic nottur, misafire gitmez.
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

    const existing = await prisma.dispute.findUnique({ where: { id: disputeId }, select: { status: true, bookingId: true } });
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

    const outcome = guestOutcomeStatus(existing.status, status);
    if (outcome) {
      void notificationService
        .notifyGuestDisputeOutcome({ bookingId: existing.bookingId, status: outcome })
        .catch((err) => logger.error({ err, disputeId }, "notify_guest_dispute_outcome_failed"));
    }
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
