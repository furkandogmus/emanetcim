import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { computeSplit } from "@/lib/platform-split";
import { COLLECTED_ORDER_BY, collectedEarningsWhere } from "@/lib/earning-collection";
import { toMobilePartnerEarningRow } from "@/lib/mobile-dto";
import { getEffectiveCommission } from "@/lib/commission";
import { startOfDayInTimeZone } from "@/lib/timezone";

export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const roleErr = requireRole(auth.user, ["PARTNER"]);
  if (roleErr) return roleErr;

  const owned = await prisma.shop.findMany({
    where: { ownerId: auth.user.id, isActive: true },
    select: { id: true, timezone: true },
  });
  // `?shop=` uygulamanin dukkan secimini izler (pano gibi); yoksa tum dukkanlar.
  const requested = req.nextUrl.searchParams.get("shop");
  const shops = requested && owned.some((s) => s.id === requested) ? owned.filter((s) => s.id === requested) : owned;

  if (shops.length === 0) {
    return NextResponse.json({ error: "no_shops" }, { status: 404 });
  }

  const shopIds = shops.map((s) => s.id);

  /*
    "BUGUN" DUKKANIN SAATINDE BASLAR.

    Onceki hali `today.setHours(0, 0, 0, 0)` idi ve SUNUCUNUN saat dilimini
    okuyordu. Uretim konteyneri UTC calisiyor, yani Istanbul'daki esnaf icin
    "bugun" 03:00'te basliyordu: gece 00:00-03:00 arasi bakan esnaf DUNUN aksam
    rezervasyonlarini bugun sayiyor, sabah baktiginda gunun ilk uc saatini
    goremiyordu. Bkz. `src/lib/timezone.ts`.

    Cok dukkanli esnafta ilk dukkanin dilimi kullaniliyor; hepsi ayni sahibin ve
    pratikte ayni ulkede. Diliminin secildigi yer burasi olsun ki, bir gun
    dukkan bazinda ayrilmasi gerekirse tek noktada degissin.
  */
  const today = startOfDayInTimeZone(shops[0].timezone ?? "Europe/Istanbul");

  /*
    Toplam, "bugun" ve gecmis AYNI tabandan: teslim edilmis emanetler, teslim
    anina gore (`earning-collection.ts`). Eskiden toplam olusturmaya, "bugun"
    check-in'e, liste yine olusturmaya bakiyordu ve kasa hicbiriyle tutmuyordu.
  */
  const shopFilter = { shopId: { in: shopIds } };

  const [aggregateResult, todayResult, history] = await Promise.all([
    prisma.booking.aggregate({
      where: { ...shopFilter, ...collectedEarningsWhere() },
      _sum: { totalPrice: true },
    }),
    prisma.booking.aggregate({
      where: { ...shopFilter, ...collectedEarningsWhere({ start: today }) },
      _sum: { totalPrice: true },
    }),
    prisma.booking.findMany({
      where: { ...shopFilter, ...collectedEarningsWhere() },
      select: {
        id: true,
        totalPrice: true,
        shopId: true,
        checkedOutAt: true,
        checkOutTime: true,
        guest: { select: { name: true } },
      },
      orderBy: COLLECTED_ORDER_BY,
      take: 10,
    }),
  ]);

  /*
    KOMISYON WEB ILE AYNI KURALDAN.

    Bu uc daha once brut tutari `totalBalance` olarak donduruyordu -- yani hicbir
    komisyon uygulamiyordu. Bugun dogru sonuc veriyor (dukkanda tahsilatta oran 0)
    ama bu bir TESADUF: PSP baglanip oran yururluge girdigi gun web "net", mobil
    "brut" gosterecekti. CLAUDE.md'deki kural bu: bir is kurali iki tasiyicida
    ayri ayri yazilmaz, ikisi de ayni kaynagi cagirir.
  */
  const { rate: commissionRate, merchantShareRatio } = await getEffectiveCommission();
  const totalEarnings = computeSplit(
    Number(aggregateResult._sum?.totalPrice ?? 0),
    commissionRate,
  ).merchantAmount;
  const todayEarnings = computeSplit(
    Number(todayResult._sum?.totalPrice ?? 0),
    commissionRate,
  ).merchantAmount;

  const formattedHistory = history.map((b) => toMobilePartnerEarningRow(b, commissionRate));

  return NextResponse.json({
    totalBalance: totalEarnings,
    todayEarnings,
    pendingPayout: 0,
    history: formattedHistory,
    currency: "TRY",
    /* Mobil de "komisyonsuz donem"i yazabilsin diye; web ile ayni sayi. */
    commissionRate,
    merchantShareRatio,
  });
}
