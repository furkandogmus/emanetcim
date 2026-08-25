import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import { bookingService } from "@/services/BookingService";
import { toMobileBookingDetail } from "@/lib/mobile-dto";
import { canAccessBooking } from "@/services/booking/access";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const b = await bookingService.getBookingDetails(id);
  if (!b) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // OKUMA: dukkan sahibi esnaf da gorebilir (panelde rezervasyonu acar).
  if (!canAccessBooking(b, auth.user, { allowShopPartner: true })) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json(toMobileBookingDetail(b));
}
