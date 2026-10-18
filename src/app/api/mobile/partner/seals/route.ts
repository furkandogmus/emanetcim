import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { toMobileSealRequest } from "@/lib/mobile-dto";

/**
 * Esnaf: muhur stogu ve son talepler (salt okuma; web `partner/seals` sayfasiyla
 * ayni sayimlar). Dukkan secimi `seals/request` ile AYNI sorgu: stok bir
 * dukkandan okunup talep baska dukkan icin acilmasin.
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const roleErr = requireRole(auth.user, ["PARTNER"]);
  if (roleErr) return roleErr;

  const shop = await prisma.shop.findFirst({
    where: { ownerId: auth.user.id, isActive: true },
    select: { id: true, sealReorderPoint: true },
  });
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
    assignedCount,
    inUseCount,
    returnedCount,
    sealReorderPoint: shop.sealReorderPoint,
    requests: requests.map(toMobileSealRequest),
  });
}
