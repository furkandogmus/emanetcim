import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import { bookingService } from "@/services/BookingService";
import { toMobileBookingDetail } from "@/lib/mobile-dto";
import { canAccessBooking, canOperateBookingAtShop } from "@/services/booking/access";
import { previewCheckOutCharges } from "@/services/booking/check-out";
import { withCancelReason } from "@/services/booking/cancel-reason";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const b = await bookingService.getBookingDetails(id);
  if (!b) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // OKUMA: dukkan sahibi esnaf da gorebilir (panelde rezervasyonu acar).
  if (!(await canAccessBooking(b, auth.user, { allowShopPartner: true }))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  /*
    Esnafa teslimden ONCE: su an teslim edilirse alinacak gecikme ucreti ve
    verilecek erken teslim iadesi. Misafire gosterilmez (o kendi fisinde gorur).
  */
  // Personel de operator: gecikme onizlemesi ve misafir telefonu tezgah isi.
  const operator = await canOperateBookingAtShop(b, auth.user);
  const checkoutPreview =
    operator && b.status === "CHECKED_IN" ? await previewCheckOutCharges(b, new Date()) : null;
  // Misafir telefonu kurali (yalniz esnaf/yonetici + aktif kayit) DTO'da.
  return NextResponse.json({ ...toMobileBookingDetail(await withCancelReason(b), { operator }), checkoutPreview });
}
