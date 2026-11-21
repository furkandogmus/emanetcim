import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { bookingService } from "@/services/BookingService";
import { toMobileBookingDetail } from "@/lib/mobile-dto";
import { canAccessBooking } from "@/services/booking/access";
import { previewCheckOutCharges } from "@/services/booking/check-out";

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

  /*
    Esnafa teslimden ONCE: su an teslim edilirse alinacak gecikme ucreti ve
    verilecek erken teslim iadesi. Misafire gosterilmez (o kendi fisinde gorur).
  */
  const operator = !requireRole(auth.user, ["PARTNER", "ADMIN"]);
  const checkoutPreview =
    operator && b.status === "CHECKED_IN" ? await previewCheckOutCharges(b, new Date()) : null;
  /*
    Misafirin telefonu YALNIZCA islemi yapan esnaf/yonetici icin ve YALNIZCA
    aktif rezervasyonda: gelmeyen ya da gec kalan misafiri aramak icin. Bitmis
    kayitta kisisel veri telefona gitmez.
  */
  const active = !["CHECKED_OUT", "CANCELLED"].includes(b.status);
  const guestPhone = operator && active ? (b.guest?.phone ?? b.guestPhone ?? "") : "";
  return NextResponse.json({ ...toMobileBookingDetail(b), guestPhone, checkoutPreview });
}
