import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireMobileUser } from "@/lib/mobile-auth";
import { bookingService } from "@/services/BookingService";
import { canAccessBooking } from "@/services/booking/access";

const modifySchema = z.object({
  checkInTime: z.string().min(1),
  checkOutTime: z.string().min(1),
  bagCountS: z.number().int().min(0).max(50).optional(),
  bagCountM: z.number().int().min(0).max(50).optional(),
  bagCountXl: z.number().int().min(0).max(50).optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const b = await bookingService.getBookingDetails(id);
  if (!b) return NextResponse.json({ error: "not_found" }, { status: 404 });

  /*
    DEGISTIRME: esnaf HARIC. Esnafin yolu "reddet"tir ve o yol iadeyi + slot
    temizligini `cancelBooking` uzerinden yurutur; buradan duzenleme yapabilseydi
    o muhasebe atlanirdi.
  */
  if (!(await canAccessBooking(b, auth.user, { allowShopPartner: false }))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = modifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { checkInTime, checkOutTime, bagCountS, bagCountM, bagCountXl } = parsed.data;

  // `?preview=1`: ayni kapilar ve ayni fiyat hesabi, yazmadan (degistirme ekraninin tutari).
  const preview = req.nextUrl.searchParams.get("preview") === "1";
  const result = await bookingService.modifyBooking(
    id,
    auth.user.id,
    {
      checkInTime: new Date(checkInTime),
      checkOutTime: new Date(checkOutTime),
      bagCountS: bagCountS ?? b.bagCountS,
      bagCountM: bagCountM ?? b.bagCountM,
      bagCountXl: bagCountXl ?? b.bagCountXl,
    },
    { dryRun: preview },
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.code || "modify_failed" }, { status: 400 });
  }

  if (preview) return NextResponse.json(result.preview);
  return NextResponse.json({ success: true });
}
