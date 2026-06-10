import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { bookingService } from "@/services/BookingService";
import prisma from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;

  const forbid = requireRole(auth.user, ["PARTNER", "ADMIN"]);
  if (forbid) return forbid;

  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { shop: { select: { ownerId: true } } },
  });
  if (!booking) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (auth.user.role !== "ADMIN" && booking.shop.ownerId !== auth.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const result = await bookingService.checkIn(id);

  if (!result.ok) {
    return NextResponse.json({ error: result.code, message: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
