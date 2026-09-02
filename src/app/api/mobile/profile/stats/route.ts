import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import prisma from "@/lib/db";
import { EARNING_BOOKING_STATUSES } from "@/lib/platform-split";
import { moneyToNumber } from "@/lib/money";

export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;

  const userId = auth.user.id;

  /*
    "HARCANAN" = PARASI ALINMIS OLAN.

    Onceki hali `status: { not: "CANCELLED" }` idi, yani PENDING,
    WAITING_APPROVAL ve APPROVED rezervasyonlari da harcamaya sayiyordu:
    misafir daha hicbir odeme yapmamisken profilinde o tutari "toplam harcama"
    olarak goruyordu.

    Bu, `platform-split.ts`in var olma sebebinin AYNISI. Orada yazili: partner
    ana paneli de "CANCELLED olmayan her sey" diyordu ve 2026-08-22'de canlida
    ayni dukkan icin iki ekranda iki farkli hakedis gorulmustu (710 TL / 490
    TL). Dogru tanim orada zaten kararlastirilmis ve tek kaynakta duruyor --
    `EARNING_BOOKING_STATUSES`. Misafirin odedigi ile esnafin hakettigi ayni
    rezervasyon kumesidir; ikisinin farkli tanimlari olamaz.
  */
  const paidWhere = {
    guestId: userId,
    status: { in: [...EARNING_BOOKING_STATUSES] },
  };

  const [totalBookings, completedBookings, totalSpent, savings] = await Promise.all([
    prisma.booking.count({ where: { guestId: userId } }),
    prisma.booking.count({ where: { guestId: userId, status: "CHECKED_OUT" } }),
    prisma.booking.aggregate({ where: paidWhere, _sum: { totalPrice: true } }),
    /*
      TASARRUF SABIT 0 DONUYORDU.

      Alan mobil profilde gosteriliyor, yani her misafire "0 TL tasarruf
      ettiniz" yaziyordu -- kupon kullanmis olsa bile. Olculebilir tek dogru
      karsiligi `couponDiscountAmount`: rezervasyon aninda dusulen tutar,
      rezervasyonun kendisiyle birlikte kayitli. Ayni odenmis-rezervasyon
      kumesi uzerinden toplanir ki "harcanan" ile ayni evreni anlatsin.
    */
    prisma.booking.aggregate({ where: paidWhere, _sum: { couponDiscountAmount: true } }),
  ]);

  return NextResponse.json({
    totalBookings,
    completedBookings,
    // `Number(...)` DEGIL: tutarlar Prisma `Decimal`; cevrim tek yerden
    // (`moneyToNumber`) yapilir.
    totalSavings: moneyToNumber(savings._sum.couponDiscountAmount),
    totalSpent: moneyToNumber(totalSpent._sum.totalPrice),
  });
}
