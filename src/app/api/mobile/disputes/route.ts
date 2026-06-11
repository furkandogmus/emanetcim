import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireMobileUser } from "@/lib/mobile-auth";
import prisma from "@/lib/db";

const disputeSchema = z.object({
  bookingId: z.string().min(1),
  reason: z.enum(["DAMAGE", "THEFT", "OTHER"]),
  description: z.string().min(10).max(2000).trim(),
});

export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const parsed = disputeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_data", details: parsed.error.flatten() }, { status: 400 });
  }

  const { bookingId, reason, description } = parsed.data;

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
