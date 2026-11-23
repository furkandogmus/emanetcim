"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { auth } from "@/auth";
import prisma from "@/lib/db";
import { assertAdmin } from "@/lib/action-auth";
import { getClientIp, getClientIpOrNull } from "@/lib/client-ip";
import { rateLimit } from "@/lib/rate-limit";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { moneyToNumber } from "@/lib/money";
import { computeAuthoritativeCheckoutTotals } from "@/lib/booking-server-price";
import { getPricingRules } from "@/lib/platform-settings";
import logger from "@/lib/logger";
import {
  AFFILIATE_COOKIE,
  adminCreateAffiliate,
  adminMarkCommissionsPaid,
  adminUpdateAffiliate,
  affiliateService,
} from "@/services/AffiliateService";
import { checkoutDiscountService } from "@/services/CheckoutDiscountService";

/** Yonetici: yeni araci. Govde `adminCreateAffiliate`da (mobil uc da onu cagirir). */
export async function createAffiliateAction(data: unknown) {
  const actor = await assertAdmin();
  const result = await adminCreateAffiliate(actor, data, { ip: await getClientIpOrNull() });
  if (!result.ok) return { success: false as const, error: result.reason };
  revalidatePathAllLocales("/admin/affiliates");
  return { success: true as const, code: result.code };
}

/** Yonetici: duzenleme ve onay (durum `active`). */
export async function updateAffiliateAction(id: string, data: unknown) {
  const actor = await assertAdmin();
  const result = await adminUpdateAffiliate(actor, id, data, { ip: await getClientIpOrNull() });
  if (!result.ok) return { success: false as const, error: result.reason };
  revalidatePathAllLocales("/admin/affiliates");
  return { success: true as const };
}

/** Yonetici: bir ayin odenmemis komisyonlarini odendi isaretle. */
export async function markAffiliateCommissionsPaidAction(input: unknown) {
  const actor = await assertAdmin();
  const result = await adminMarkCommissionsPaid(actor, input, { ip: await getClientIpOrNull() });
  if (!result.ok) return { success: false as const, error: result.reason };
  revalidatePathAllLocales("/admin/affiliates");
  return { success: true as const, count: result.count, total: result.total };
}

export type AffiliateApplyState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; error: "Errors.invalidInput" | "Errors.tooManyRequests" | "Errors.generic" | "Errors.affiliateAlreadyApplied" };

/** Herkese acik "Araci ol" formu. Giris gerekmez; girisliyse hesap baglanir. */
export async function applyAffiliateAction(_prev: AffiliateApplyState, formData: FormData): Promise<AffiliateApplyState> {
  // Bal kupu: dolduran bottur, basari gibi gorunur.
  if (String(formData.get("website") ?? "").length > 0) return { status: "success" };
  const ip = await getClientIp();
  if (!(await rateLimit(`affiliate-apply:${ip}`, 5, 10 * 60_000))) {
    return { status: "error", error: "Errors.tooManyRequests" };
  }
  const session = await auth();
  try {
    const result = await affiliateService.submitApplication(
      {
        displayName: formData.get("displayName") ?? "",
        type: formData.get("type") ?? "",
        contactEmail: formData.get("contactEmail") ?? undefined,
        contactPhone: formData.get("contactPhone") ?? undefined,
        applicationNote: formData.get("applicationNote") ?? undefined,
      },
      { userId: session?.user?.id ?? null },
    );
    if (!result.ok) {
      return { status: "error", error: result.reason === "already_applied" ? "Errors.affiliateAlreadyApplied" : "Errors.invalidInput" };
    }
    return { status: "success" };
  } catch (err) {
    logger.error({ err }, "affiliate_apply_failed");
    return { status: "error", error: "Errors.generic" };
  }
}

const previewSchema = z.object({
  shopId: z.string().uuid(),
  bagCountS: z.number().int().min(0).max(20),
  bagCountM: z.number().int().min(0).max(20),
  bagCountXl: z.number().int().min(0).max(20),
  checkInTime: z.date(),
  checkOutTime: z.date(),
  couponCode: z.string().trim().max(64).optional(),
  referralCode: z.string().trim().max(32).optional(),
  guestEmail: z.string().trim().max(320).optional(),
});

/**
 * Web odeme ekrani: araci cerezi varken fiyat SUNUCUDA hesaplanir ve
 * "Referans indirimi" satiri buradan gelir (mobil `checkout/quote` ile ayni
 * servis). Cerez yoksa `null`: ekran eski davranisini surdurur.
 */
export async function previewAffiliateCheckoutAction(input: unknown) {
  const code = (await cookies()).get(AFFILIATE_COOKIE)?.value;
  if (!code) return null;
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) return null;
  const d = parsed.data;
  const ip = await getClientIp();
  if (!(await rateLimit(`affiliate_preview:ip:${ip}`, 60, 10 * 60_000))) return null;

  const shop = await prisma.shop.findUnique({ where: { id: d.shopId }, select: { pricePerDay: true } });
  if (!shop) return null;
  const totals = computeAuthoritativeCheckoutTotals(
    moneyToNumber(shop.pricePerDay),
    d.bagCountS,
    d.bagCountM,
    d.bagCountXl,
    d.checkInTime,
    d.checkOutTime,
    await getPricingRules(),
  );
  const session = await auth();
  const q = await checkoutDiscountService.preview({
    subtotal: totals.subtotalBeforeCoupon,
    // Web'de kupon ve davet kodu ayri alanlar: `claim` ile ayni girdiler.
    couponCode: d.couponCode || undefined,
    referralCode: d.couponCode ? undefined : d.referralCode || undefined,
    affiliateCode: code,
    guest: { userId: session?.user?.id, guestEmail: d.guestEmail },
  });
  if (!q.affiliate || (q.affiliate.status !== "applied" && q.affiliate.status !== "attributed")) return null;
  return {
    subtotal: totals.subtotalBeforeCoupon,
    total: q.total,
    discount: q.discount,
    affiliateApplied: q.affiliate.status === "applied",
    affiliatePct: q.affiliate.ratePct,
  };
}
