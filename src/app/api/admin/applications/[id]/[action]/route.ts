import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getMobileSession } from "@/lib/mobile-auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const session = await getMobileSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, action } = await params;

  if (action === "approve") {
    await prisma.shop.update({
      where: { id },
      data: { isActive: true },
    });
  } else if (action === "reject") {
    const activeBookingCount = await prisma.booking.count({
      where: { shopId: id, status: { in: ["APPROVED", "PAID", "CHECKED_IN"] } },
    });
    if (activeBookingCount > 0) {
      return NextResponse.json(
        { error: "Shop has active bookings; cannot delete." },
        { status: 409 }
      );
    }
    await prisma.shop.delete({ where: { id } });
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
