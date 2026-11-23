/**
 * Rezervasyonu KAPATAN islemler: yonetici iptali, zorla teslim, esnaf iptali,
 * "misafir gelmedi" ve hesap silmede suresi dolanlar. Gec birakmada otomatik
 * kapanis `LateDropoffService`te.
 *
 * Her iptal `cancelBooking` uzerinden gecer (atomik kilit, slot, kupon, iade
 * defteri tek yerde); zorla teslim `checkOut` uzerinden. Bu modul yalnizca
 * kapilari (yetki, durum, aciklama, zaman) ve denetim/bildirim eklerini tasir.
 * Web action'i ve mobil uc AYNI fonksiyonu cagirir.
 */
import { BookingStatus } from '@prisma/client';
import prisma from '@/lib/db';
import logger from '@/lib/logger';
import { writeAuditLog } from '@/lib/audit-log';
import {
  ADMIN_NOTE_MIN_LENGTH,
  NOT_DROPPED_STATUSES,
  isNotDroppedStatus,
  isPartnerCancelReason,
  noShowAvailableAt,
} from '@/lib/booking-closure';
import { cancelBooking } from '@/services/booking/lifecycle';
import { checkOut } from '@/services/booking/check-out';
import { canOperateBookingAtShop } from '@/services/booking/access';
import { bookingNotificationEmail } from '@/services/booking/guest-contact';
import { notificationService } from '@/services/NotificationService';
import type { PaymentActor } from '@/services/PaymentService';
import type { Role } from '@prisma/client';

export type ClosureActor = { id: string; role: Role; impersonatedBy?: string | null };

export type ClosureErrorCode =
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'INVALID_STATUS'
  | 'NOTE_REQUIRED'
  | 'INVALID_REASON'
  | 'TOO_EARLY'
  /** "Misafiri bekle" alma saatine dayandi, daha fazla uzatilamaz. */
  | 'HOLD_LIMIT'
  | 'UNKNOWN';

export type ClosureResult = { ok: true } | { ok: false; code: ClosureErrorCode };

const NOTE_MAX_LENGTH = 1000;

function cleanNote(note: unknown): string {
  return typeof note === 'string' ? note.trim().slice(0, NOTE_MAX_LENGTH) : '';
}

function paymentActor(actor: ClosureActor): PaymentActor {
  return { id: actor.id, role: actor.role, impersonatedBy: actor.impersonatedBy ?? null };
}

function loadBooking(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      checkInTime: true,
      guestId: true,
      guestEmail: true,
      locale: true,
      guest: { select: { email: true } },
      shop: { select: { ownerId: true } },
    },
  });
}

/** Esnaf islemini dukkan sahibi degil (yonetici) yaptiysa dukkan haberdar edilir. */
function isShopOwner(booking: { shop: { ownerId: string } }, actor: ClosureActor): boolean {
  return booking.shop.ownerId === actor.id;
}

function fromCancelFailure(code: string): ClosureErrorCode {
  return code === 'NOT_FOUND' || code === 'INVALID_STATUS' ? code : 'UNKNOWN';
}

/** Yonetici iptali: check-in oncesi her durum, aciklama zorunlu. */
export async function adminCancelBooking(
  bookingId: string,
  actor: ClosureActor,
  input: { note: unknown; ip?: string | null },
): Promise<ClosureResult> {
  if (actor.role !== 'ADMIN') return { ok: false, code: 'FORBIDDEN' };
  const booking = await loadBooking(bookingId);
  if (!booking) return { ok: false, code: 'NOT_FOUND' };
  const note = cleanNote(input.note);
  if (note.length < ADMIN_NOTE_MIN_LENGTH) return { ok: false, code: 'NOTE_REQUIRED' };
  if (!isNotDroppedStatus(booking.status)) return { ok: false, code: 'INVALID_STATUS' };

  const result = await cancelBooking(bookingId, { actor: paymentActor(actor), reason: 'admin_cancel', note });
  if (!result.ok) return { ok: false, code: fromCancelFailure(result.code) };

  writeAuditLog({
    actorUserId: actor.id,
    actorRole: 'ADMIN',
    action: 'admin.booking.cancel',
    entityType: 'Booking',
    entityId: bookingId,
    metadata: { note, previousStatus: booking.status },
    ip: input.ip ?? null,
  });
  return { ok: true };
}

/**
 * Yonetici zorla teslimi: yalnizca CHECKED_IN. Muhur ve durum kurallari
 * `checkOut`ta kalir; gecikme ucreti kesilmez.
 */
export async function adminForceCheckOut(
  bookingId: string,
  actor: ClosureActor,
  input: { note: unknown; ip?: string | null },
): Promise<ClosureResult> {
  if (actor.role !== 'ADMIN') return { ok: false, code: 'FORBIDDEN' };
  const booking = await loadBooking(bookingId);
  if (!booking) return { ok: false, code: 'NOT_FOUND' };
  const note = cleanNote(input.note);
  if (note.length < ADMIN_NOTE_MIN_LENGTH) return { ok: false, code: 'NOTE_REQUIRED' };
  if (booking.status !== BookingStatus.CHECKED_IN) return { ok: false, code: 'INVALID_STATUS' };

  const result = await checkOut(bookingId, { actor: paymentActor(actor), forced: { note } });
  if (!result.ok) {
    return { ok: false, code: result.code === 'NOT_FOUND' || result.code === 'INVALID_STATUS' ? result.code : 'UNKNOWN' };
  }

  writeAuditLog({
    actorUserId: actor.id,
    actorRole: 'ADMIN',
    action: 'admin.booking.force_checkout',
    entityType: 'Booking',
    entityId: bookingId,
    metadata: { note },
    ip: input.ip ?? null,
  });

  const locale = booking.locale ?? 'tr';
  const email = bookingNotificationEmail(booking);
  if (email) {
    void notificationService
      .notifyCheckOut(email, bookingId, locale)
      .catch((err) => logger.error({ err, bookingId }, 'notify_force_checkout_guest_failed'));
  } else {
    notificationService.pushGuestOnly(bookingId, 'checkOut', locale);
  }
  void notificationService
    .notifyPartnerAdminAction({ bookingId, kind: 'force_checked_out', note })
    .catch((err) => logger.error({ err, bookingId }, 'notify_force_checkout_partner_failed'));
  return { ok: true };
}

/** Esnaf iptali: valiz birakilmadan once, nedenli; "diger" aciklama ister. */
export async function partnerCancelBooking(
  bookingId: string,
  actor: ClosureActor,
  input: { reason: unknown; note?: unknown },
): Promise<ClosureResult> {
  const booking = await loadBooking(bookingId);
  if (!booking) return { ok: false, code: 'NOT_FOUND' };
  if (!canOperateBookingAtShop(booking, actor)) return { ok: false, code: 'FORBIDDEN' };
  if (!isPartnerCancelReason(input.reason)) return { ok: false, code: 'INVALID_REASON' };
  const note = cleanNote(input.note);
  if (input.reason === 'other' && note.length === 0) return { ok: false, code: 'NOTE_REQUIRED' };
  if (!isNotDroppedStatus(booking.status)) return { ok: false, code: 'INVALID_STATUS' };

  const result = await cancelBooking(bookingId, {
    actor: paymentActor(actor),
    reason: 'partner_cancel',
    detail: input.reason,
    note: note || null,
    notifyPartner: !isShopOwner(booking, actor),
  });
  return result.ok ? { ok: true } : { ok: false, code: fromCancelFailure(result.code) };
}

/** "Misafir gelmedi": check-in saatinden `NO_SHOW_GRACE_MINUTES` sonra. */
export async function markNoShow(
  bookingId: string,
  actor: ClosureActor,
  now: Date = new Date(),
): Promise<ClosureResult> {
  const booking = await loadBooking(bookingId);
  if (!booking) return { ok: false, code: 'NOT_FOUND' };
  if (!canOperateBookingAtShop(booking, actor)) return { ok: false, code: 'FORBIDDEN' };
  const availableAt = noShowAvailableAt(booking);
  if (!availableAt) return { ok: false, code: 'INVALID_STATUS' };
  if (now.getTime() < availableAt.getTime()) return { ok: false, code: 'TOO_EARLY' };

  const result = await cancelBooking(bookingId, {
    actor: paymentActor(actor),
    reason: 'no_show',
    notifyPartner: !isShopOwner(booking, actor),
  });
  return result.ok ? { ok: true } : { ok: false, code: fromCancelFailure(result.code) };
}

/**
 * Hesap silmede: misafirin suresi dolmus (birakilmamis, alma saati gecmis)
 * rezervasyonlari silmeyi ENGELLEMEZ, kapanir. Silme aninda alma saati gecmis
 * olmasi yeter.
 */
export async function closeExpiredBookingsForGuest(userId: string, now: Date = new Date()): Promise<number> {
  const rows = await prisma.booking.findMany({
    where: {
      guestId: userId,
      status: { in: [...NOT_DROPPED_STATUSES] },
      checkOutTime: { lt: now },
      checkedInAt: null,
    },
    select: { id: true },
  });
  let closed = 0;
  for (const { id } of rows) {
    const r = await cancelBooking(id, { silent: true, reason: 'expired_no_dropoff' });
    if (r.ok) closed++;
    // Silme yine devam eder; kapanmayan kayit `late-dropoff-scan`de kapanir.
    else logger.warn({ bookingId: id, userId, code: r.code }, 'account_delete_expired_close_failed');
  }
  return closed;
}
