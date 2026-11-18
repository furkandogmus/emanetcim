import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { requireMobileUser } from "@/lib/mobile-auth";
import { computeAuthoritativeCheckoutTotals } from "@/lib/booking-server-price";
import { getPricingRules } from "@/lib/platform-settings";
import { moneyToNumber } from "@/lib/money";
import { applyReferralDiscount } from "@/lib/referral-discount";
import { snapStayToShopHours } from "@/lib/stay-days";
import { loadScheduleParts } from "@/services/ShopScheduleService";
import { toDatetimeLocalValueInTimeZone } from "@/lib/datetime-local";
import { couponService } from "@/services/CouponService";
import { referralService } from "@/services/ReferralService";

/**
 * Odeme ekrani fiyat ONIZLEMESI (2026-11-18).
 *
 * Mobil odeme ekraninda indirim kodu girilemiyordu; sunucu `couponCode` ve
 * `referralCode` alanlarini `/checkout/intent`te zaten isliyordu. Misafir tek
 * bir "indirim kodu" alanina yazar, bu uc onun kupon mu davet kodu mu oldugunu
 * ve indirimli tutari soyler. Kural ve aritmetik `intent` ile AYNI servislerden
 * gelir; tek fark burada kupon kotasi ALINMAZ (`preview`).
 *
 * Baglayici degil: rezervasyon aninda `intent` yeniden karar verir.
 */
const schema = z.object({
  shopId: z.string().uuid(),
  checkInTime: z.string().datetime(),
  checkOutTime: z.string().datetime(),
  bagCountS: z.number().int().min(0).max(20),
  bagCountM: z.number().int().min(0).max(20),
  bagCountXl: z.number().int().min(0).max(20),
  code: z.string().trim().min(1).max(64).optional(),
});

type CodeStatus = "applied" | "invalid" | "min_price" | "own_code" | "not_first_booking";

export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;

  // Kupon kodu tahminine karsi: kullanici basina 10 dakikada 30 onizleme.
  if (!(await rateLimit(`checkout_quote:user:${auth.user.id}`, 30, 10 * 60_000))) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  const d = parsed.data;
  if (d.bagCountS + d.bagCountM + d.bagCountXl === 0) {
    return NextResponse.json({ error: "no_bags" }, { status: 400 });
  }

  const shop = await prisma.shop.findUnique({
    where: { id: d.shopId },
    select: {
      id: true,
      pricePerDay: true,
      isActive: true,
      isTest: true,
      isPrelaunch: true,
      open247: true,
      openingTime: true,
      closingTime: true,
      timezone: true,
    },
  });
  if (!shop?.isActive || shop.isTest || shop.isPrelaunch) {
    return NextResponse.json({ error: "shop_not_found" }, { status: 404 });
  }

  // `intent` ile ayni oturtma: onizlenen saat ve tutar, olusacak rezervasyonunki.
  const requestedIn = new Date(d.checkInTime);
  const schedule = (await loadScheduleParts([shop.id], toDatetimeLocalValueInTimeZone(requestedIn).slice(0, 10))).get(shop.id);
  const snapped = snapStayToShopHours(
    { open247: shop.open247, openingTime: shop.openingTime, closingTime: shop.closingTime, timeZone: shop.timezone, ...schedule },
    requestedIn,
    new Date(d.checkOutTime),
  );
  if (!snapped) return NextResponse.json({ error: "shop_closed_at_time" }, { status: 409 });

  const totals = computeAuthoritativeCheckoutTotals(
    moneyToNumber(shop.pricePerDay),
    d.bagCountS,
    d.bagCountM,
    d.bagCountXl,
    snapped.checkIn,
    snapped.checkOut,
    await getPricingRules(),
  );
  const subtotal = totals.subtotalBeforeCoupon;

  let total = subtotal;
  let discount: { kind: "coupon" | "referral"; code: string; amount: number } | null = null;
  let codeStatus: CodeStatus | null = null;
  let minPrice: number | undefined;

  if (d.code) {
    // Once kupon: `intent` de kuponu once dener ve kupon varsa davet indirimi uygulanmaz.
    const coupon = await couponService.preview(d.code, subtotal);
    if (coupon.ok) {
      total = coupon.totalPrice;
      discount = { kind: "coupon", code: coupon.code, amount: coupon.discountAmount };
      codeStatus = "applied";
    } else if (coupon.reason === "min_price") {
      codeStatus = "min_price";
      minPrice = coupon.minPrice;
    } else {
      const referral = await referralService.check(d.code, { userId: auth.user.id });
      if (referral.ok && referral.discountPct > 0) {
        const applied = applyReferralDiscount(subtotal, referral.discountPct);
        total = applied.totalPrice;
        discount = { kind: "referral", code: referral.code, amount: applied.discountAmount };
        codeStatus = "applied";
      } else {
        codeStatus = referral.ok ? "invalid" : referral.reason === "invalid_code" ? "invalid" : referral.reason;
      }
    }
  }

  return NextResponse.json({
    subtotal,
    total,
    discount,
    codeStatus,
    minPrice: minPrice ?? null,
    checkInTime: snapped.checkIn.toISOString(),
    checkOutTime: snapped.checkOut.toISOString(),
    hoursNotice: snapped.drop || snapped.pickup ? { drop: snapped.drop ?? null, pickup: snapped.pickup ?? null } : null,
  });
}
