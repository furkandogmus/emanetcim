import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import prisma from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const { id } = await params;
  // `update` olmayan kayitta P2025 firlatip 500 veriyordu; sayi kontrolu 404.
  const { count } = await prisma.contactMessage.updateMany({
    where: { id },
    data: { isRead: true },
  });
  if (count === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const { id } = await params;
  const { count } = await prisma.contactMessage.deleteMany({ where: { id } });
  if (count === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
