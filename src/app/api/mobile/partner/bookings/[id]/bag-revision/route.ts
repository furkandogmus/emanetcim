import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";

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

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });

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
