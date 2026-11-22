import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import prisma from "@/lib/db";
import { cursorArgs, parseCursor, toPage } from "@/lib/cursor-page";
import { toMobilePartnerBookingRow } from "@/lib/mobile-dto";
import { withCancelReasons } from "@/services/booking/cancel-reason";
import { partnerBookingSearchWhere } from "@/services/PartnerBookingSearchService";

export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["PARTNER"]);
  if (forbid) return forbid;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
  // `cursor` (yeni istemci, Gecmis sekmesinde "Daha eski kayitlar"): yalnizca gecmis, imlecten sonrasi.
  // Eski istemci `page` ile gelir; o yol degismedi.
  const cursor = parseCursor(searchParams.get("cursor"));
  const skip = cursor ? 0 : (page - 1) * limit;

  const shops = await prisma.shop.findMany({
    where: { ownerId: auth.user.id },
    select: { id: true, name: true },
  });

  // `shopId` yalnizca esnafin KENDI dukkanlari icinde daraltir; baskasininki bos liste verir.
  const shopIdParam = searchParams.get("shopId")?.trim();
  const shopIds = shops.map((s) => s.id).filter((id) => !shopIdParam || id === shopIdParam);
  const shopMap = new Map(shops.map((s) => [s.id, s.name]));
  // `q`: kod on eki / ad / telefon kuyrugu (`PartnerBookingSearchService`, web ile ortak).
  const search = await partnerBookingSearchWhere(shopIds, searchParams.get("q"));

  /*
    AKTIFLER HER ZAMAN, gecmis sayfali (2026-11-18). Liste "en son olusturulan
    100" idi: 100 rezervasyonu gecen dukkanda, eskiden yapilmis ama BUGUN
    gelecek ya da hala dukkanda duran valiz listeden dusuyordu (ozet kart onu
    sayarken liste gostermiyordu). Aktif = valiz dukkanda ya da bitisi bugun
    sonrasi (son 24 saat dahil); gecmis bitise gore yeniden eskiye.
  */
  const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const activeWhere = {
    shopId: { in: shopIds },
    ...search,
    OR: [{ status: "CHECKED_IN" as const }, { checkOutTime: { gte: recentCutoff } }],
  };
  const [active, history, total] = await Promise.all([
    page === 1 && !cursor
      ? prisma.booking.findMany({
          where: activeWhere,
          include: { guest: { select: { name: true } } },
          orderBy: { checkInTime: "asc" },
          // Tavan: bir dukkanin ayni anda 500 aktif rezervasyonu gercekci degil.
          take: 500,
        })
      : Promise.resolve([]),
    prisma.booking.findMany({
      where: { shopId: { in: shopIds }, ...search, status: { not: "CHECKED_IN" }, checkOutTime: { lt: recentCutoff } },
      include: { guest: { select: { name: true } } },
      orderBy: [{ checkOutTime: "desc" }, { id: "desc" }],
      ...(cursor ? cursorArgs(cursor, limit) : { skip, take: limit + 1 }),
    }),
    prisma.booking.count({ where: { shopId: { in: shopIds }, ...search } }),
  ]);
  const historyPage = toPage(history, limit);
  const allBookings = [...active, ...historyPage.items];

  const results = (await withCancelReasons(allBookings)).map((b) =>
    toMobilePartnerBookingRow(b, shopMap.get(b.shopId) ?? ""),
  );

  // `nextCursor`: gecmiste daha eski kayit var mi. `total` aktifleri de sayar, sayfalamayi suremez.
  return NextResponse.json({ items: results, total, page, limit, nextCursor: historyPage.nextCursor });
}
