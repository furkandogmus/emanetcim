import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { writeAuditLog } from "@/lib/audit-log";
import { bookingTimeZone } from "@/lib/format-datetime";
import { DEFAULT_NOTIFICATION_LOCALE } from "@/lib/request-locale";
import { LATE_ACTIONABLE_STATUSES, decideLateHold, isLateHoldActive } from "@/lib/late-dropoff";
import { bookingEventService } from "@/services/BookingEventService";
import { notificationService } from "@/services/NotificationService";
import { canOperateBookingAtShop } from "@/services/booking/access";
import { bookingNotificationEmail } from "@/services/booking/guest-contact";
import type { ClosureActor, ClosureErrorCode } from "@/services/booking/closure";

export type LateHoldResult = { ok: true; until: Date } | { ok: false; code: ClosureErrorCode };

/**
 * "Misafiri bekle": gec kalan misafirin otomatik kapanisini 30 dk ileri alir
 * (kural `decideLateHold`). Web action'i ve mobil uc AYNI fonksiyonu cagirir.
 * Dukkan sahibi esnaf ya da yonetici.
 *
 * Yazim KOSULLU: okunan `lateHoldUntil` hala ayniysa ve valiz birakilmadiysa.
 * Iki es zamanli basis iki kez 30 dk eklemez; check-in ya da otomatik kapanis
 * arada geldiyse yazim eslesmez. Surum (`bookingRowVersion`) ARTIRILMAZ: tezgahta
 * ayni anda yapilan check-in bekletme yuzunden "durum degisti" yememeli.
 */
export async function holdLateBooking(
  bookingId: string,
  actor: ClosureActor,
  now: Date = new Date(),
): Promise<LateHoldResult> {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      checkInTime: true,
      checkOutTime: true,
      checkedInAt: true,
      lateHoldUntil: true,
      guestId: true,
      guestEmail: true,
      locale: true,
      guest: { select: { email: true } },
      shop: { select: { id: true, ownerId: true, name: true, timezone: true, owner: { select: { phone: true } } } },
    },
  });
  if (!b) return { ok: false, code: "NOT_FOUND" };
  if (!(await canOperateBookingAtShop(b, actor))) return { ok: false, code: "FORBIDDEN" };

  const decision = decideLateHold(b, now);
  if (!decision.ok) return { ok: false, code: decision.code };

  const written = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: { in: [...LATE_ACTIONABLE_STATUSES] },
      checkedInAt: null,
      lateHoldUntil: b.lateHoldUntil,
      // Karar bu saatlerden hesaplandi; arada degisiklik (modifyBooking) geldiyse yazma.
      checkInTime: b.checkInTime,
      checkOutTime: b.checkOutTime,
    },
    data: { lateHoldUntil: decision.until },
  });
  if (written.count === 0) return { ok: false, code: "INVALID_STATUS" };

  void bookingEventService
    .record({
      bookingId,
      event: "LATE_HOLD",
      actorId: actor.id,
      actorRole: actor.role,
      impersonatedBy: actor.impersonatedBy ?? null,
      metadata: { until: decision.until.toISOString(), previousCloseAt: decision.previousCloseAt.toISOString() },
    })
    .catch((err) => logger.error({ err, bookingId }, "booking_event_late_hold_failed"));

  if (actor.role === "ADMIN") {
    writeAuditLog({
      actorUserId: actor.id,
      actorRole: "ADMIN",
      action: "admin.booking.late_hold",
      entityType: "Booking",
      entityId: bookingId,
      metadata: { until: decision.until.toISOString() },
    });
  }

  // Yalnizca bekletme serisinin ilkinde: suren bekletmeyi uzatmak misafire yeni haber degil.
  const streakStart = !isLateHoldActive(b, now);
  const email = bookingNotificationEmail(b);
  if (streakStart && (email != null || b.guestId != null)) {
    void notificationService
      .sendLateDropoffNotice({
        bookingId,
        kind: "hold",
        email,
        hasAccount: b.guestId != null,
        locale: b.locale ?? DEFAULT_NOTIFICATION_LOCALE,
        at: decision.until,
        checkOutAt: b.checkOutTime,
        shop: { name: b.shop.name, phone: b.shop.owner.phone, timeZone: bookingTimeZone(b.shop) },
        now,
      })
      .catch((err) => logger.warn({ err, bookingId }, "late_hold_guest_notice_failed"));
  }
  return { ok: true, until: decision.until };
}
