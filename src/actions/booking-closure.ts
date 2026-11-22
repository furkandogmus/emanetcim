"use server";

import { requireAdmin, requirePartner } from "@/lib/action-auth";
import { getClientIp } from "@/lib/get-ip";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import {
  adminCancelBooking,
  adminForceCheckOut,
  markNoShow,
  partnerCancelBooking,
  type ClosureErrorCode,
  type ClosureResult,
} from "@/services/booking/closure";

/**
 * Rezervasyon kapatma action'lari. Govde `src/services/booking/closure.ts`te;
 * mobil uclar (`/api/mobile/{admin,partner}/bookings/[id]/...`) ayni
 * fonksiyonlari cagirir. Burada yalniz oturum, hata anahtari ve `revalidate`.
 */

const CLOSURE_ERROR_TO_KEY: Record<ClosureErrorCode, string> = {
  NOT_FOUND: "Errors.bookingNotFound",
  FORBIDDEN: "Errors.unauthorized",
  INVALID_STATUS: "Errors.bookingStateConflict",
  NOTE_REQUIRED: "Errors.closureNoteRequired",
  INVALID_REASON: "Errors.closureInvalidReason",
  TOO_EARLY: "Errors.noShowTooEarly",
  UNKNOWN: "Errors.generic",
};

function toActionResult(result: ClosureResult, bookingId: string) {
  if (!result.ok) return { success: false as const, error: CLOSURE_ERROR_TO_KEY[result.code] };
  revalidatePathAllLocales(`/admin/bookings/${bookingId}`);
  revalidatePathAllLocales(`/partner/bookings/${bookingId}`);
  revalidatePathAllLocales("/partner");
  revalidatePathAllLocales("/bookings");
  return { success: true as const };
}

export async function adminCancelBookingAction(bookingId: string, note: string) {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false as const, error: auth.error };
  const result = await adminCancelBooking(bookingId, auth.actor, { note, ip: await getClientIp() });
  return toActionResult(result, bookingId);
}

export async function adminForceCheckOutAction(bookingId: string, note: string) {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false as const, error: auth.error };
  const result = await adminForceCheckOut(bookingId, auth.actor, { note, ip: await getClientIp() });
  return toActionResult(result, bookingId);
}

export async function partnerCancelBookingAction(bookingId: string, reason: string, note: string) {
  const auth = await requirePartner();
  if (!auth.ok) return { success: false as const, error: auth.error };
  const result = await partnerCancelBooking(bookingId, auth.actor, { reason, note });
  return toActionResult(result, bookingId);
}

export async function markNoShowAction(bookingId: string) {
  const auth = await requirePartner();
  if (!auth.ok) return { success: false as const, error: auth.error };
  const result = await markNoShow(bookingId, auth.actor);
  return toActionResult(result, bookingId);
}
