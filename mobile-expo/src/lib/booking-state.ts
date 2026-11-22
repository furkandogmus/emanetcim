import type { BookingStatus } from "./types";

/**
 * Valiz henuz dukkana birakilmamis durumlar. Tek liste: misafir/esnaf/yonetici iptali,
 * degistirme ve "suresi doldu" kurali hep buna bakar.
 */
export const BEFORE_DROP_OFF: ReadonlySet<string> = new Set<BookingStatus>(["PENDING", "WAITING_APPROVAL", "APPROVED", "PAID"]);

export function isBeforeDropOff(status: string): boolean {
  return BEFORE_DROP_OFF.has(status);
}

/** `cancelReason` degerleri (sunucu `Booking.cancelReason`); tip buradan turer. */
export const CANCEL_REASONS = ["guest_cancel", "partner_cancel", "no_show", "admin_cancel", "expired_no_dropoff"] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];

export function isCancelReason(v: unknown): v is CancelReason {
  return typeof v === "string" && (CANCEL_REASONS as readonly string[]).includes(v);
}

/**
 * Misafir rezervasyonunun "suresi doldu" durumu. Karar SUNUCUDA (`expired`,
 * `../src/lib/mobile-dto.ts` `isBookingExpired`): bekleyen/onayli/odenmis, valiz hic
 * birakilmamis ve alma saati gecmis. Alan yoksa (eski sunucu, cihazdaki eski
 * bilet) ayni kural yerel saatle uygulanir.
 */
export function isBookingExpired(
  b: { status: string; checkOutTime: string; expired?: boolean },
  now: number = Date.now(),
): boolean {
  if (typeof b.expired === "boolean") return b.expired;
  return BEFORE_DROP_OFF.has(b.status) && new Date(b.checkOutTime).getTime() < now;
}
