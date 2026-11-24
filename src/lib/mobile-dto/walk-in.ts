import type { WalkInSuccess } from "@/services/WalkInBookingService";
import type { ShopSourceStats, SourceBreakdown } from "@/services/BookingSourceService";

/** `POST partner/walk-in` basari govdesi. QR'i istemci `qrCodeToken`dan cizer. */
export function toMobileWalkInResult(r: WalkInSuccess) {
  return {
    bookingId: r.bookingId,
    shortCode: r.shortCode,
    qrCodeToken: r.qrCodeToken,
    totalPrice: r.totalPrice,
    checkInTime: r.checkInTime,
    checkOutTime: r.checkOutTime,
    checkedIn: r.checkedIn,
    needsCheckIn: r.needsCheckIn,
    checkInErrorCode: r.checkInErrorCode,
    emailQueued: r.emailQueued,
  };
}

/** Panodaki afis / kapidan gelen sayilari. Yeni alan: eski istemci okumaz. */
export function toMobileShopSourceStats(s: ShopSourceStats) {
  return {
    thisMonth: { poster: s.thisMonth.poster, walkIn: s.thisMonth.walkIn },
    lastMonth: { poster: s.lastMonth.poster, walkIn: s.lastMonth.walkIn },
  };
}

export function toMobileBookingSourceBreakdown(b: SourceBreakdown) {
  return { web: b.web, app: b.app, walkIn: b.walk_in, poster: b.poster, unknown: b.unknown };
}
