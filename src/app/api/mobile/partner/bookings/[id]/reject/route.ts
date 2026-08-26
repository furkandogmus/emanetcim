import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { bookingService } from "@/services/BookingService";
import { REVIEW_CODE_TO_HTTP } from "@/lib/mobile-review-response";

/**
 * Esnafin rezervasyon talebini reddetmesi (mobil).
 *
 * 2026-08-25'e kadar bu uc `prisma.booking.update({ status: CANCELLED })` yaziyordu.
 * Sonucu: iade/odeme niyeti kapatilmiyordu ve `ReservationSlot` satirlari SILINMIYORDU,
 * yani reddedilen rezervasyon dukkanin kapasitesini kalici olarak tutuyordu. Artik
 * `BookingService.rejectBooking` -> `cancelBooking` yolu, web ile birebir ayni.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const roleErr = requireRole(auth.user, ["PARTNER"]);
  if (roleErr) return roleErr;
  const { id } = await params;

  const result = await bookingService.rejectBooking(id, {
    id: auth.user.id,
    role: "PARTNER",
  });

  if (!result.ok) {
    const { status, error } = REVIEW_CODE_TO_HTTP[result.code];
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({ success: true });
}
