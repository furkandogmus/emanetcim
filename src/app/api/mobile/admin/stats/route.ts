import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { EARNING_BOOKING_STATUSES } from "@/lib/platform-split";
import { moneyToNumber } from "@/lib/money";
import prisma from "@/lib/db";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";

export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  /*
    ELLE YAZILMIS ROL KONTROLU DEGIL. Bu uc `auth.user.role !== "ADMIN"` diye
    kendi kapisini yaziyordu; diger uc admin ucu (`applications`, `messages`,
    `messages/[id]`) `requireRole` cagiriyor. Bugun ikisi ayni govdeyi donuyor
    (`{ error: "forbidden" }`, 403), yani davranis farki YOKTU -- ama kapinin
    kendisi kopyaydi ve kopya kapi, degistigi gun tek yerde degisir.
  */
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const [totalBookings, totalRevenueResult, totalPartners, pendingApps, unreadMessages] = await Promise.all([
    prisma.booking.count(),
    prisma.booking.aggregate({
      /*
        ELLE YAZILMIS LISTE DEGIL. Bu uc statuleri kendi icinde sayiyordu ve
        bugun web admin paneliyle ayni sonucu veriyordu -- ama bu bir TESADUF.
        Kume tek bir yerde tanimli (`EARNING_BOOKING_STATUSES`) ve orada
        degistigi gun mobil admin, web admin'den sessizce ayrisirdi. Ayni
        kural iki tasiyicida ayri ayri yazilmaz.
      */
      where: { status: { in: [...EARNING_BOOKING_STATUSES] } },
      _sum: { totalPrice: true },
    }),
    prisma.shop.count(),
    prisma.shop.count({ where: { isActive: false } }),
    prisma.contactMessage.count({ where: { isRead: false } }),
  ]);

  return NextResponse.json({
    totalBookings,
    // Tutarlar Prisma `Decimal`; cevrim tek yerden.
    totalRevenue: moneyToNumber(totalRevenueResult._sum.totalPrice),
    totalPartners,
    pendingApplications: pendingApps,
    unreadMessages,
  });
}
