import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { shopService } from "@/services/ShopService";
import prisma from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["PARTNER"]);
  if (forbid) return forbid;

  const shop = await shopService.getShopByOwner(auth.user.id);

  if (!shop) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  const sealCount = await prisma.seal.count({
    where: { shopId: shop.id, status: "ASSIGNED" }
  });

  return NextResponse.json({
    ...shop,
    pricePerDay: Number(shop.pricePerDay),
    sealCount,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["PARTNER"]);
  if (forbid) return forbid;

  const shop = await shopService.getShopByOwner(auth.user.id);

  if (!shop) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const updated = await shopService.updateShop(shop.id, {
      name: body.name,
      capacity: body.capacity,
      pricePerDay: body.pricePerDay,
      openingTime: body.openingTime,
      closingTime: body.closingTime,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 });
  }
}
