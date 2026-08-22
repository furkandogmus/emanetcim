import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { computeAuthoritativeCheckoutTotals } from "@/lib/booking-server-price";
import { getPricingRules } from "@/lib/platform-settings";
import { moneyToNumber } from "@/lib/money";
import { readPricingSnapshot } from "@/lib/pricing-snapshot";
import { bookingEventService } from "@/services/BookingEventService";
import logger from "@/lib/logger";

const VALID_STATUSES = ["APPROVED", "PAID"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const roleErr = requireRole(auth.user, ["PARTNER"]);
  if (roleErr) return roleErr;
  const { id } = await params;

  const { bagCountS, bagCountM, bagCountXl } = await req.json();
  const s = typeof bagCountS === "number" ? bagCountS : undefined;
  const m = typeof bagCountM === "number" ? bagCountM : undefined;
  const xl = typeof bagCountXl === "number" ? bagCountXl : undefined;

  if (s === undefined && m === undefined && xl === undefined) {
    return NextResponse.json({ error: "no_bag_counts" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { shop: { select: { ownerId: true, pricePerDay: true } } },
  });
  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (booking.shop.ownerId !== auth.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!VALID_STATUSES.includes(booking.status as string)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const newS = s ?? booking.bagCountS;
  const newM = m ?? booking.bagCountM;
  const newXl = xl ?? booking.bagCountXl;

  if (newS + newM + newXl <= 0) {
    return NextResponse.json({ error: "at_least_one_bag" }, { status: 400 });
  }

  try {
    /**
     * Rezervasyonun KENDİ fiyat kuralları kullanılır (anlık kopya) — o gün geçerli
     * olan kural budur. Kopya yoksa bugünküler; hangisinin kullanıldığı denetim
     * izine yazılıyor.
     *
     * Eskiden koşulsuz `getPricingRules()` çağrılıyordu, yani admin bir çarpanı
     * değiştirdikten sonra yapılan bir valiz revizyonu, rezervasyonun tamamını
     * yeni fiyata çeviriyordu (P0-4 ile aynı sınıf).
     */
    const snapshot = readPricingSnapshot(booking.pricingSnapshot);
    const rules = snapshot ?? (await getPricingRules());
    const pricePerDay = moneyToNumber(booking.shop.pricePerDay);

    const totals = computeAuthoritativeCheckoutTotals(
      pricePerDay,
      newS,
      newM,
      newXl,
      new Date(booking.checkInTime),
      new Date(booking.checkOutTime),
      rules
    );

    const previousTotal = moneyToNumber(booking.totalPrice);

    await prisma.booking.update({
      where: { id },
      data: {
        bagCountS: totals.bagCountS,
        bagCountM: totals.bagCountM,
        bagCountXl: totals.bagCountXl,
        unitPrice: totals.unitPrice,
        insuranceFee: totals.insuranceFee,
        totalPrice: totals.subtotalBeforeCoupon,
      },
    });

    // Denetim izi: web yolundaki `applyPendingBagRevisionAction` ile aynı biçim.
    // Valiz sayısı para demektir; kim değiştirdi ve fark ne kadardı, kayıtlı olmalı.
    await bookingEventService
      .record({
        bookingId: id,
        event: "BAGS_MODIFIED",
        actorId: auth.user.id,
        actorRole: "PARTNER",
        metadata: {
          from: {
            S: booking.bagCountS,
            M: booking.bagCountM,
            XL: booking.bagCountXl,
            total: previousTotal,
          },
          to: {
            S: totals.bagCountS,
            M: totals.bagCountM,
            XL: totals.bagCountXl,
            total: totals.subtotalBeforeCoupon,
          },
          delta:
            Math.round((totals.subtotalBeforeCoupon - previousTotal) * 100) / 100,
          rulesSource: snapshot ? "booking_snapshot" : "current_platform_settings",
          source: "mobile",
          /** Fark henüz tahsil edilmedi — bkz. P1-21. */
          settled: false,
        },
      })
      .catch((err) =>
        logger.error({ err, bookingId: id }, "bag_revision_event_failed"),
      );

    return NextResponse.json({ success: true, newTotal: totals.subtotalBeforeCoupon });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
