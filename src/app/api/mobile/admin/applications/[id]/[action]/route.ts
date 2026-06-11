import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import prisma from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const { id, action } = await params;

  if (action === "approve") {
    const activeBookingCount = await prisma.booking.count({
      where: { shopId: id, status: { in: ["APPROVED", "PAID", "CHECKED_IN"] } },
    });
    if (activeBookingCount > 0) {
      return NextResponse.json({ error: "Shop has active bookings; cannot delete." }, { status: 409 });
    }
    await prisma.shop.update({ where: { id }, data: { isActive: true } });
  } else if (action === "reject") {
    await prisma.shop.delete({ where: { id } });
    await prisma.seal.updateMany({
      where: { shopId: id, status: "ASSIGNED" },
      data: { status: "STOCK", shopId: null, assignedAt: null },
    });
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
