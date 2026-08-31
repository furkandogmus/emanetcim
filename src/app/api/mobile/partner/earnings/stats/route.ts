import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { EARNING_BOOKING_STATUSES, computeSplit } from "@/lib/platform-split";
import { getEffectiveCommission } from "@/lib/commission";
import { startOfDayInTimeZone } from "@/lib/timezone";

export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const roleErr = requireRole(auth.user, ["PARTNER"]);
  if (roleErr) return roleErr;

  const shops = await prisma.shop.findMany({
    where: { ownerId: auth.user.id, isActive: true },
    select: { id: true, timezone: true },
  });

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

  // Partner ana paneli ve web kazanç sayfasıyla AYNI tanım — tek doğru kaynak
  // platform-split.ts'te. Eskiden burada ayrıca `paymentLog: SUCCESS` şartı vardı;
  // bu, kısmi iade sonrası (PaymentLog SUCCESS'ten PARTIALLY_REFUNDED'a düşünce)
  // mobilin bir rezervasyonu web'in saydığı yerde saymamasına yol açıyordu — P0-7
  // (partner panelinde iki farklı NET HAKEDİŞ) ile aynı desen, bu kez web/mobil
  // arasında. Bkz. docs/KOD_TARAMA_2026-08-23.md, BULGU 16.
  const baseWhere = {
    shopId: { in: shopIds },
    status: { in: [...EARNING_BOOKING_STATUSES] },
  };

  const [aggregateResult, todayResult, history] = await Promise.all([
    prisma.booking.aggregate({
      where: baseWhere,
      _sum: { totalPrice: true },
    }),
    prisma.booking.aggregate({
      where: { ...baseWhere, createdAt: { gte: today } },
      _sum: { totalPrice: true },
    }),
    prisma.booking.findMany({
      where: baseWhere,
      select: { totalPrice: true, createdAt: true, shopId: true },
      orderBy: { createdAt: "desc" },
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

  const formattedHistory = history.map((b) => ({
    date: b.createdAt.toISOString().slice(5, 10).replace("-", " "),
    // Liste de esnaf payini gosterir; ustteki toplamla ayni birim olmasi sart.
    amount: computeSplit(Number(b.totalPrice), commissionRate).merchantAmount,
    shopId: b.shopId,
    status: "PAID" as const,
  }));

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
