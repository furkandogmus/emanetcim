/**
 * Misafir rezervasyonunun "suresi doldu" durumu. Karar SUNUCUDA (`expired`,
 * `../src/lib/mobile-dto.ts` `isBookingExpired`): onayli/odenmis, valiz hic
 * birakilmamis ve alma saati gecmis. Alan yoksa (eski sunucu, cihazdaki eski
 * bilet) ayni kural yerel saatle uygulanir.
 */
const NEVER_DROPPED = new Set(["APPROVED", "PAID"]);

export function isBookingExpired(
  b: { status: string; checkOutTime: string; expired?: boolean },
  now: number = Date.now(),
): boolean {
  if (typeof b.expired === "boolean") return b.expired;
  return NEVER_DROPPED.has(b.status) && new Date(b.checkOutTime).getTime() < now;
}
