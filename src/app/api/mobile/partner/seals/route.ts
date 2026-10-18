import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { toMobileSealRequest } from "@/lib/mobile-dto";
import { resolvePartnerShops } from "@/lib/partner-shop";

/**
 * Esnaf: muhur stogu ve son talepler (salt okuma; web `partner/seals` sayfasiyla
 * ayni sayimlar). Dukkan secimi web sayfasiyla ve `seals/request` ile AYNI
 * (`resolvePartnerShops`, `?shop=`): stok bir dukkandan okunup talep baska
 * dukkan icin acilmasin. Eskiden sirasiz `findFirst` idi; cok dukkanli esnafta
 * stok rastgele dukkandan geliyordu (2026-10-18).
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const roleErr = requireRole(auth.user, ["PARTNER"]);
  if (roleErr) return roleErr;

  const { activeShop } = await resolvePartnerShops(auth.user.id, req.nextUrl.searchParams.get("shop"));
  const shop = activeShop
    ? await prisma.shop.findUnique({
        where: { id: activeShop.id },
        select: { id: true, name: true, sealReorderPoint: true },
      })
    : null;
  if (!shop) return NextResponse.json({ error: "no_shop" }, { status: 404 });

  const [assignedCount, inUseCount, returnedCount, requests] = await Promise.all([
    prisma.seal.count({ where: { shopId: shop.id, status: "ASSIGNED" } }),
    prisma.seal.count({ where: { shopId: shop.id, status: "IN_USE" } }),
    prisma.seal.count({ where: { shopId: shop.id, status: "RETURNED" } }),
    prisma.sealRequest.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({
    shop: { id: shop.id, name: shop.name },
    assignedCount,
    inUseCount,
    returnedCount,
    sealReorderPoint: shop.sealReorderPoint,
    requests: requests.map(toMobileSealRequest),
  });
}
