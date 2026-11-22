import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import { bookingService } from "@/services/BookingService";
import { canGuestSelfCancel } from "@/services/booking/access";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const b = await bookingService.getBookingDetails(id);
  if (!b) return NextResponse.json({ error: "not_found" }, { status: 404 });

  /*
    Yalniz misafirin kendisi. Esnafin yolu `partner/bookings/[id]/cancel`,
    yoneticininki `admin/bookings/[id]/cancel` (zorunlu aciklama + denetim).
  */
  if (!canGuestSelfCancel(b, auth.user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const result = await bookingService.cancelBooking(id, {
      actor: { id: auth.user.id, role: auth.user.role, impersonatedBy: auth.user.impersonatedBy ?? null },
      reason: "guest_cancel",
    });
    if (result.ok) {
      return NextResponse.json({ success: true, fullRefund: result.fullRefund });
    }
    // Kod tasinir ki ekran "zaten iptal / teslim edildi" ile "bulunamadi"yi ayirabilsin.
    const error =
      result.code === "INVALID_STATUS" ? "invalid_status" : result.code === "NOT_FOUND" ? "not_found" : "cancel_failed";
    return NextResponse.json({ error }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
