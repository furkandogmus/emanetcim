import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";

const VALID_STATUSES = ["APPROVED", "PAID", "CHECKED_IN"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const roleErr = requireRole(auth.user, ["PARTNER"]);
  if (roleErr) return roleErr;
  const { id } = await params;

  const { bagCountS, bagCountM, bagCountXl } = await req.json();
  const s = typeof bagCountS === "number" ? bagCountS : undefined;
  const m = typeof bagCountM === "number" ? bagCountM : undefined;
  const xl = typeof bagCountXl === "number" ? bagCountXl : undefined;

  if (s === undefined && m === undefined && xl === undefined) {
    return NextResponse.json({ error: "no_bag_counts" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { shop: { select: { ownerId: true } } },
  });
  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (booking.shop.ownerId !== auth.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!VALID_STATUSES.includes(booking.status as string)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  try {
    const data: Record<string, number> = {};
    if (s !== undefined) data.bagCountS = s;
    if (m !== undefined) data.bagCountM = m;
    if (xl !== undefined) data.bagCountXl = xl;

    await prisma.booking.update({ where: { id }, data });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
