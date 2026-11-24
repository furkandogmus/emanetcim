import type { WalkInRequest } from "./types";

/** Tezgahta tarih secici yok (native modul eklenmez): planli alma saati cipleri. */
export const WALK_IN_PICKUP_HOURS = [2, 4, 8, 24, 48] as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Form -> istek govdesi; eksik/bozuk alanda `null` (dugme kapali). Asil dogrulama sunucuda
 * (`WalkInBookingService`); burada yalniz bariz hatalar sunucuya gitmesin.
 */
export function walkInRequest(
  f: { name: string; phone: string; email: string; bags: string; hours: number; terms: boolean },
  now: number = Date.now(),
): WalkInRequest | null {
  const name = f.name.trim();
  const phone = f.phone.trim();
  const email = f.email.trim();
  const bagCount = Number(f.bags);
  if (name.length < 2 || !f.terms) return null;
  if (!Number.isInteger(bagCount) || bagCount < 1 || bagCount > 50) return null;
  if (email && !EMAIL.test(email)) return null;
  if (phone && phone.replace(/\D/g, "").length < 7) return null;
  return {
    guestName: name,
    ...(phone ? { guestPhone: phone } : {}),
    ...(email ? { guestEmail: email } : {}),
    bagCount,
    pickupAt: new Date(now + f.hours * 60 * 60 * 1000).toISOString(),
    termsConfirmed: true,
  };
}
