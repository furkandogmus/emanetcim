/**
 * Odeme indirimi secimi: kupon, kullanici davet kodu ve araci misafir indirimi.
 * Web `createBookingAction`, mobil `checkout/intent` ve `checkout/quote` AYNI
 * kurali buradan alir.
 *
 * KURAL: rezervasyona TEK indirim uygulanir. Mevcut kural zaten buydu (kupon
 * varsa davet indirimi yok). Araci indirimi ile kupon/davet indirimi ikisi de
 * gecerliyse BUYUK OLAN uygulanir; esitlikte araci indirimi (kupon kotasi
 * bosuna yanmaz, davet kodunun "ilk rezervasyon" hakki da durur).
 *
 * Atif indirimden bagimsizdir: araci indirimi kaybetse de (ya da oran 0 olsa
 * da) rezervasyon aracinin hanesine yazilir; komisyon misafirin odedigi son
 * toplamdan hesaplanir.
 */
import { applyReferralDiscount } from "@/lib/referral-discount";
import { couponService } from "@/services/CouponService";
import { referralService, type ReferralGuest, type ReferralRejection } from "@/services/ReferralService";
import {
  affiliateService,
  applyAffiliateGuestDiscount,
  type AffiliateAttribution,
} from "@/services/AffiliateService";

export type AffiliateQuote = {
  code: string;
  /** `applied`: indirim uygulandi; `attributed`: atif var, indirim yok ya da daha buyuk indirim kazandi. */
  status: "applied" | "attributed" | "invalid" | "own_code";
  ratePct: number;
  amount: number;
};

type ResolvedAffiliate =
  | { kind: "ok"; attribution: AffiliateAttribution; amount: number }
  | { kind: "rejected"; reason: "invalid_code" | "own_code"; code: string };

async function resolveAffiliate(
  code: string | null | undefined,
  guest: ReferralGuest,
  subtotal: number,
): Promise<ResolvedAffiliate | null> {
  if (!code?.trim()) return null;
  const r = await affiliateService.resolve(code, guest);
  if (!r.ok) return { kind: "rejected", reason: r.reason, code: code.trim().toUpperCase() };
  const pct = r.attribution.guestDiscountRate;
  const amount = pct.gt(0) ? applyAffiliateGuestDiscount(subtotal, pct).discountAmount : 0;
  return { kind: "ok", attribution: r.attribution, amount };
}

function affiliateQuote(a: ResolvedAffiliate | null, applied: boolean): AffiliateQuote | null {
  if (!a) return null;
  if (a.kind === "rejected") return { code: a.code, status: a.reason === "own_code" ? "own_code" : "invalid", ratePct: 0, amount: 0 };
  return {
    code: a.attribution.code,
    status: applied ? "applied" : "attributed",
    ratePct: a.attribution.guestDiscountRate.toNumber(),
    amount: applied ? a.amount : 0,
  };
}

export type CheckoutDiscountClaim = {
  totalPrice: number;
  couponDiscountAmount: number;
  couponCode?: string;
  /** Rezervasyon yazilamazsa `couponService.release` ile geri verilir. */
  couponId?: string;
  referralDiscountAmount: number;
  referredByCode?: string;
  affiliateDiscountAmount: number;
  /** Atfedilen araci kodu; `createInitialBooking` atfi bununla yeniden dogrular ve yazar. */
  affiliateCode?: string;
  affiliate: AffiliateAttribution | null;
};

export class CheckoutDiscountService {
  /** Rezervasyon aninda: kupon hakki gerekiyorsa ALINIR. */
  async claim(input: {
    subtotal: number;
    couponCode?: string;
    referralCode?: string;
    affiliateCode?: string | null;
    guest: ReferralGuest;
  }): Promise<CheckoutDiscountClaim> {
    const { subtotal, guest } = input;
    const aff = await resolveAffiliate(input.affiliateCode, guest, subtotal);
    const attribution = aff?.kind === "ok" ? aff.attribution : null;
    const affAmount = aff?.kind === "ok" ? aff.amount : 0;

    const base: CheckoutDiscountClaim = {
      totalPrice: subtotal,
      couponDiscountAmount: 0,
      referralDiscountAmount: 0,
      affiliateDiscountAmount: 0,
      affiliateCode: attribution?.code,
      affiliate: attribution,
    };

    if (input.couponCode) {
      // Araci indirimi varsa kotayi yakmadan once buyuklugu karsilastir.
      const worthClaiming =
        affAmount <= 0 ||
        (await couponService.preview(input.couponCode, subtotal).then((p) => p.ok && p.discountAmount > affAmount));
      if (worthClaiming) {
        const claim = await couponService.claim(input.couponCode, subtotal);
        if (claim.ok) {
          return {
            ...base,
            totalPrice: claim.claimed.totalPrice,
            couponDiscountAmount: claim.claimed.discountAmount,
            couponCode: claim.claimed.code,
            couponId: claim.claimed.couponId,
          };
        }
      }
    }

    // Davet indirimi: kupon uygulanmadiysa (mevcut kural).
    const referral = await referralService.resolveDiscount(input.referralCode, guest, subtotal);
    if (referral && referral.discountAmount > affAmount) {
      return {
        ...base,
        totalPrice: referral.totalPrice,
        referralDiscountAmount: referral.discountAmount,
        referredByCode: referral.code,
      };
    }

    if (attribution && affAmount > 0) {
      const applied = applyAffiliateGuestDiscount(subtotal, attribution.guestDiscountRate);
      return { ...base, totalPrice: applied.totalPrice, affiliateDiscountAmount: applied.discountAmount };
    }
    return base;
  }

  /**
   * Onizleme (mobil `checkout/quote`): kota ALINMAZ. `code` tek "indirim kodu"
   * alanidir: once kupon, sonra davet kodu olarak denenir.
   */
  async preview(input: {
    subtotal: number;
    code?: string;
    affiliateCode?: string | null;
    guest: ReferralGuest;
  }): Promise<{
    total: number;
    discount: { kind: "coupon" | "referral" | "affiliate"; code: string; amount: number } | null;
    codeStatus: "applied" | "invalid" | "min_price" | "not_combinable" | ReferralRejection | null;
    minPrice: number | null;
    affiliate: AffiliateQuote | null;
  }> {
    const { subtotal, guest } = input;
    const aff = await resolveAffiliate(input.affiliateCode, guest, subtotal);
    const affAmount = aff?.kind === "ok" ? aff.amount : 0;

    let codeDiscount: { kind: "coupon" | "referral"; code: string; amount: number; total: number } | null = null;
    let codeStatus: "applied" | "invalid" | "min_price" | "not_combinable" | ReferralRejection | null = null;
    let minPrice: number | null = null;

    if (input.code) {
      const coupon = await couponService.preview(input.code, subtotal);
      if (coupon.ok) {
        codeDiscount = { kind: "coupon", code: coupon.code, amount: coupon.discountAmount, total: coupon.totalPrice };
      } else if (coupon.reason === "min_price") {
        codeStatus = "min_price";
        minPrice = coupon.minPrice ?? null;
      } else {
        const referral = await referralService.check(input.code, guest);
        if (referral.ok && referral.discountPct > 0) {
          const applied = applyReferralDiscount(subtotal, referral.discountPct);
          codeDiscount = { kind: "referral", code: referral.code, amount: applied.discountAmount, total: applied.totalPrice };
        } else {
          codeStatus = referral.ok ? "invalid" : referral.reason;
        }
      }
    }

    if (codeDiscount && codeDiscount.amount > affAmount) {
      return {
        total: codeDiscount.total,
        discount: { kind: codeDiscount.kind, code: codeDiscount.code, amount: codeDiscount.amount },
        codeStatus: "applied",
        minPrice,
        affiliate: affiliateQuote(aff, false),
      };
    }
    if (aff?.kind === "ok" && affAmount > 0) {
      const applied = applyAffiliateGuestDiscount(subtotal, aff.attribution.guestDiscountRate);
      return {
        total: applied.totalPrice,
        discount: { kind: "affiliate", code: aff.attribution.code, amount: applied.discountAmount },
        // Kod gecerliydi ama daha buyuk referans indirimi zaten uygulaniyor.
        codeStatus: codeDiscount ? "not_combinable" : codeStatus,
        minPrice,
        affiliate: affiliateQuote(aff, true),
      };
    }
    return { total: subtotal, discount: null, codeStatus, minPrice, affiliate: affiliateQuote(aff, false) };
  }
}

export const checkoutDiscountService = new CheckoutDiscountService();
