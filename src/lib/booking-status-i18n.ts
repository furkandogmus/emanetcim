/** Prisma `BookingStatus` — `Guest.bookingStatus_<STATUS>` çeviri anahtarları mevcut. */
export const GUEST_BOOKING_STATUS_I18N = new Set([
  "WAITING_APPROVAL",
  "APPROVED",
  "PENDING",
  "PAID",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
]);

export function guestBookingStatusMessageKey(status: string): string | null {
  if (!GUEST_BOOKING_STATUS_I18N.has(status)) return null;
  return `bookingStatus_${status}`;
}
