import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import prisma from "@/lib/db";

export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const { bookingId, reason, description } = body;

  if (!bookingId || !reason || !description) {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  if (!["DAMAGE", "THEFT", "OTHER"].includes(reason)) {
    return NextResponse.json({ error: "invalid_reason" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, guestId: true },
  });

  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (booking.guestId !== auth.user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const dispute = await prisma.dispute.create({
      data: {
        bookingId,
        reason,
        description,
        status: "OPEN",
      },
    });
    return NextResponse.json({ success: true, id: dispute.id });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
