import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { shopService } from "@/services/ShopService";
import prisma from "@/lib/db";

const shopUpdateSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  capacity: z.number().int().min(1).max(10000).optional(),
  pricePerDay: z.number().min(1).max(100000).optional(),
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
});

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
    const parsed = shopUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_input", details: parsed.error.flatten() }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.capacity !== undefined) data.capacity = parsed.data.capacity;
    if (parsed.data.pricePerDay !== undefined) data.pricePerDay = new Prisma.Decimal(parsed.data.pricePerDay);
    if (parsed.data.openingTime !== undefined) data.openingTime = parsed.data.openingTime;
    if (parsed.data.closingTime !== undefined) data.closingTime = parsed.data.closingTime;

    const updated = await shopService.updateShop(shop.id, data);

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 });
  }
}
