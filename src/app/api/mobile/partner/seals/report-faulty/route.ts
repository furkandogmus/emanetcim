import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";

export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const roleErr = requireRole(auth.user, ["PARTNER"]);
  if (roleErr) return roleErr;

  const { serialNumber } = await req.json();
  if (!serialNumber) {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  try {
    const seal = await prisma.seal.findUnique({ where: { serialNumber } });
    if (!seal) return NextResponse.json({ error: "not_found" }, { status: 404 });

    await prisma.seal.update({
      where: { serialNumber },
      data: { status: "FAULTY" },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
