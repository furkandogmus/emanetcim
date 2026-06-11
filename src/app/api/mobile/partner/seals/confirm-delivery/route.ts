import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";

export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const roleErr = requireRole(auth.user, ["PARTNER"]);
  if (roleErr) return roleErr;

  const shop = await prisma.shop.findFirst({ where: { ownerId: auth.user.id, isActive: true } });
  if (!shop) return NextResponse.json({ error: "no_shop" }, { status: 404 });

  const { requestId } = await req.json();
  if (!requestId) {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  try {
    const request = await prisma.sealRequest.findFirst({
      where: { id: requestId, shopId: shop.id, status: "SHIPPED" },
    });

    if (!request) return NextResponse.json({ error: "not_found" }, { status: 404 });

    await prisma.sealRequest.update({
      where: { id: requestId },
      data: { status: "DELIVERED" },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
