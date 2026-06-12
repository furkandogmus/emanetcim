import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { computeAuthoritativeCheckoutTotals } from "@/lib/booking-server-price";
import { getPricingRules } from "@/lib/platform-settings";
import { moneyToNumber } from "@/lib/money";

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
    const rules = await getPricingRules();
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
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
