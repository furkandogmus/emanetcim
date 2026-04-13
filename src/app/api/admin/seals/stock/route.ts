import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LOW_STOCK_THRESHOLD = 10;

/**
 * Admin: Mühür stok durumu ve düşük stoklu dükkânlar.
 * GET /api/admin/seals/stock?threshold=10
 */
export async function GET(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const threshold = Math.max(
    1,
    parseInt(url.searchParams.get("threshold") ?? String(DEFAULT_LOW_STOCK_THRESHOLD), 10) ||
      DEFAULT_LOW_STOCK_THRESHOLD
  );

  const [stockCounts, totalStock, totalInUse, totalFaulty] = await Promise.all([
    // Her dükkân için ASSIGNED mühür sayısı
    prisma.seal.groupBy({
      by: ["shopId", "status"],
      _count: { serialNumber: true },
      where: { shopId: { not: null } },
    }),
    // Genel stok özeti
    prisma.seal.count({ where: { status: "STOCK" } }),
    prisma.seal.count({ where: { status: "IN_USE" } }),
    prisma.seal.count({ where: { status: "FAULTY" } }),
  ]);

  // Dükkân başına ASSIGNED mühür sayısını hesapla
  const shopAssigned = new Map<string, number>();
  for (const row of stockCounts) {
    if (!row.shopId || row.status !== "ASSIGNED") continue;
    shopAssigned.set(row.shopId, row._count.serialNumber);
  }

  // Düşük stoklu dükkânları bul
  const lowStockShopIds = [...shopAssigned.entries()]
    .filter(([, count]) => count < threshold)
    .map(([shopId]) => shopId);

  const lowStockShops =
    lowStockShopIds.length > 0
      ? await prisma.shop.findMany({
          where: { id: { in: lowStockShopIds } },
          select: { id: true, name: true, address: true },
        })
      : [];

  const lowStockDetails = lowStockShops.map((shop) => ({
    shopId: shop.id,
    shopName: shop.name,
    address: shop.address,
    assignedSeals: shopAssigned.get(shop.id) ?? 0,
    threshold,
  }));

  // Hiç mühür atanmamış aktif dükkânlar
  const allActiveShops = await prisma.shop.findMany({
    where: { isActive: true },
    select: { id: true, name: true, address: true },
  });
  const shopsWithNoSeals = allActiveShops.filter(
    (s) => !shopAssigned.has(s.id)
  );

  return NextResponse.json({
    summary: {
      totalStock,
      totalInUse,
      totalFaulty,
      threshold,
    },
    lowStockShops: lowStockDetails,
    shopsWithNoSeals: shopsWithNoSeals.map((s) => ({
      shopId: s.id,
      shopName: s.name,
      address: s.address,
    })),
    alert: lowStockDetails.length > 0 || shopsWithNoSeals.length > 0,
  });
}
