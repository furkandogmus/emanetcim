import { api } from "./api";
import { isBeforeDropOff, isCancelReason } from "./booking-state";
import { wallParts } from "./time";
import type {
  BookingActionResponse,
  BookingStatus,
  CancelReason,
  PartnerCancelReason,
  PartnerCancelRequest,
} from "./types";

/*
  Yonetici ve esnafin rezervasyon yonetimi (iptal, zorla teslim, gelmedi). Kurallar
  SUNUCUDA; burada yalnizca hangi dugmenin gorunecegi ve govdenin bicimi var. Sunucu
  ayni kontrolleri yeniden yapar ve kodla reddeder (`bookingActions.errors.*`).
*/

/** Errors namespace: `errorMessage(err, BOOKING_ACTIONS_NS)`. */
export const BOOKING_ACTIONS_NS = "bookingActions";

/** Yonetici notunun alt siniri (sunucu `note_required` ile ayni kurali uygular). */
export const ADMIN_NOTE_MIN = 5;

export function isAdminNoteValid(note: string): boolean {
  return note.trim().length >= ADMIN_NOTE_MIN;
}

export type AdminBookingAction = "cancel" | "forceCheckout";

/** Yonetici detayinda hangi islem sunulur: once iptal, valiz dukkandaysa zorla teslim. */
export function adminActionFor(status: BookingStatus): AdminBookingAction | null {
  if (isBeforeDropOff(status)) return "cancel";
  if (status === "CHECKED_IN") return "forceCheckout";
  return null;
}

/** Esnaf iptali yalnizca teslim almadan once. */
export function canPartnerCancel(status: BookingStatus): boolean {
  return isBeforeDropOff(status);
}

/** Secicideki sira; "Diger" en sonda ve not ister. */
export const PARTNER_CANCEL_REASONS: readonly PartnerCancelReason[] = ["guest_request", "shop_closed", "capacity", "other"];

/**
 * Esnaf iptal govdesi; gecersizse `null` (dugme kapali kalir). "Diger" bos olmayan not
 * ister; diger nedenlerde not istege bagli ve bossa hic gonderilmez.
 */
export function partnerCancelBody(reason: PartnerCancelReason | null, note: string): PartnerCancelRequest | null {
  if (!reason) return null;
  const trimmed = note.trim();
  if (reason === "other" && !trimmed) return null;
  return trimmed ? { reason, note: trimmed } : { reason };
}

export type NoShowState =
  /** Sunucu bu rezervasyonda "gelmedi" sunmuyor (ya da eski sunucu alani gondermiyor). */
  | { kind: "hidden" }
  /** Gorunur ama kapali; `at` aninda acilir. */
  | { kind: "waiting"; at: Date }
  | { kind: "ready" };

export function noShowState(availableAt: string | null | undefined, now: number = Date.now()): NoShowState {
  if (!availableAt) return { kind: "hidden" };
  const at = new Date(availableAt);
  if (Number.isNaN(at.getTime())) return { kind: "hidden" };
  return at.getTime() <= now ? { kind: "ready" } : { kind: "waiting", at };
}

export type LateDropoffState =
  | { kind: "hidden" }
  /** Birakma saati gecti, valiz yok. `holdUntil` bekletme suruyorsa bittigi an. */
  | { kind: "late"; closeAt: Date; holdUntil: Date | null; actionable: boolean; canHold: boolean };

/**
 * Gec birakma bilgisi (sunucu `lateCloseAt`). "Misafiri bekle" yalnizca teslim
 * alinabilir (`actionable`: APPROVED/PAID) durumda gorunur ve kapanis alma saatine
 * dayanmadiysa acilir; sunucu ayni kurali uygular (`hold_limit`).
 */
export function lateDropoffState(
  b: { status: BookingStatus; checkInTime: string; checkOutTime: string; lateCloseAt?: string | null; lateHoldUntil?: string | null },
  now: number = Date.now(),
): LateDropoffState {
  if (!b.lateCloseAt) return { kind: "hidden" };
  const closeAt = new Date(b.lateCloseAt);
  if (Number.isNaN(closeAt.getTime()) || now < new Date(b.checkInTime).getTime()) return { kind: "hidden" };
  const hold = b.lateHoldUntil ? new Date(b.lateHoldUntil) : null;
  const holdUntil = hold && hold.getTime() > now ? hold : null;
  const actionable = b.status === "APPROVED" || b.status === "PAID";
  const canHold = actionable && closeAt.getTime() < new Date(b.checkOutTime).getTime();
  return { kind: "late", closeAt, holdUntil, actionable, canHold };
}

/** Bekleme yazisinda saat yeter mi, gun de mi gerekir (Istanbul duvar saatiyle). */
export function isSameWallDay(a: Date | string, b: Date | string): boolean {
  const x = wallParts(a);
  const y = wallParts(b);
  return x.year === y.year && x.month === y.month && x.day === y.day;
}

/**
 * Iptal nedeni yalnizca iptal edilmis rezervasyonda okunur. Eski sunucunun eksik alani
 * (`undefined`) ve henuz tanimadigimiz yeni deger `null` olur: ekranda neden yazilmaz.
 */
export function cancelReasonOf(b: { status: BookingStatus; cancelReason?: string | null }): CancelReason | null {
  if (b.status !== "CANCELLED") return null;
  const r = b.cancelReason;
  return isCancelReason(r) ? r : null;
}

/**
 * Ceviri anahtari. `short` liste rozeti, `long` detay satiri. Misafir kendi iptalini
 * "misafir tarafindan" diye degil "sen iptal ettin" diye okur.
 */
export function cancelReasonKey(
  reason: CancelReason | null,
  variant: "short" | "long",
  audience: "guest" | "staff" = "staff",
): string | null {
  if (!reason) return null;
  if (variant === "long" && audience === "guest" && reason === "guest_cancel") return "cancelReason.guestSelf";
  return `cancelReason.${variant}.${reason}`;
}

const enc = encodeURIComponent;

export function adminCancelBooking(id: string, note: string) {
  return api<BookingActionResponse>(`/admin/bookings/${enc(id)}/cancel`, { method: "POST", body: { note: note.trim() } });
}

export function adminForceCheckout(id: string, note: string) {
  return api<BookingActionResponse>(`/admin/bookings/${enc(id)}/force-checkout`, {
    method: "POST",
    body: { note: note.trim() },
  });
}

export function partnerCancelBooking(id: string, body: PartnerCancelRequest) {
  return api<BookingActionResponse>(`/partner/bookings/${enc(id)}/cancel`, { method: "POST", body });
}

export function partnerLateHold(id: string) {
  return api<BookingActionResponse>(`/partner/bookings/${enc(id)}/hold`, { method: "POST", body: {} });
}

export function partnerNoShow(id: string) {
  return api<BookingActionResponse>(`/partner/bookings/${enc(id)}/no-show`, { method: "POST", body: {} });
}
