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

  const { count } = await req.json();
  const requestCount = Math.min(Math.max(1, count || 10), 100);

  try {
    const sealRequest = await prisma.sealRequest.create({
      data: { shopId: shop.id, quantity: requestCount, status: "PENDING" },
    });
    return NextResponse.json({ success: true, id: sealRequest.id, count: requestCount });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
