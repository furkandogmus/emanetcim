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
import { applyAppDiscount, type CheckoutChannel } from "@/lib/app-discount";
import { getPricingRules } from "@/lib/platform-settings";
import { couponService } from "@/services/CouponService";
import { referralService, type ReferralRejection } from "@/services/ReferralService";
import {
  affiliateService,
  applyAffiliateGuestDiscount,
  type AffiliateAttribution,
  type AffiliateGuest,
} from "@/services/AffiliateService";

type ReferralGuest = AffiliateGuest;

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

/**
 * Uygulama kanali indirimi: kod indirimlerinden ONCE, ara toplamdan. Web kanalinda
 * (ya da oran 0) sifir. Kanal tasiyicinin rotasindan gelir, istemciden degil.
 */
async function resolveAppDiscount(channel: CheckoutChannel | undefined, subtotal: number) {
  if (channel !== "app") return { pct: 0, discountAmount: 0, totalPrice: subtotal };
  const rules = await getPricingRules();
  return applyAppDiscount(subtotal, rules.appBookingDiscountPct);
}

export type CheckoutDiscountClaim = {
  totalPrice: number;
  /** Uygulama kanali indirimi (TRY); kod indirimleri bundan sonra kalan tutara uygulanir. */
  appDiscountAmount: number;
  appDiscountPct: number;
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

type Candidate = { code: string; amount: number; total: number };

/**
 * TEK secici -- `claim` ve `preview` ikisi de bunu cagirir, sira ayni:
 * kupon gecerliyse davet indirimi aday olmaz (mevcut kural); kalan aday ile
 * araci indirimi karsilastirilir, buyuk olan kazanir, esitlikte araci.
 * Saf fonksiyon: veritabanina ve kotaya dokunmaz.
 */
export function chooseSingleDiscount(c: {
  coupon: Candidate | null;
  referral: Candidate | null;
  affiliate: Candidate | null;
}): "coupon" | "referral" | "affiliate" | null {
  const baseKind = c.coupon ? "coupon" : c.referral ? "referral" : null;
  const base = c.coupon ?? c.referral;
  if (c.affiliate && c.affiliate.amount > 0 && (!base || c.affiliate.amount >= base.amount)) return "affiliate";
  return baseKind;
}

type CodeStatus = "applied" | "invalid" | "min_price" | "not_combinable" | ReferralRejection | null;

/** Kupon ve davet adaylari; kota ALINMAZ. Iki yol da ayni adaylari gorur. */
async function gatherCandidates(input: {
  subtotal: number;
  couponCode?: string;
  referralCode?: string;
  guest: ReferralGuest;
}) {
  const { subtotal, guest } = input;
  let coupon: Candidate | null = null;
  let couponStatus: CodeStatus = null;
  let minPrice: number | null = null;
  if (input.couponCode) {
    const p = await couponService.preview(input.couponCode, subtotal);
    if (p.ok) coupon = { code: p.code, amount: p.discountAmount, total: p.totalPrice };
    else if (p.reason === "min_price") {
      couponStatus = "min_price";
      minPrice = p.minPrice ?? null;
    } else couponStatus = "invalid";
  }
  let referral: Candidate | null = null;
  let referralStatus: CodeStatus = null;
  // Kupon gecerliyse davet kodu aday olmaz; sorgu da atlanir.
  if (!coupon && input.referralCode) {
    const r = await referralService.check(input.referralCode, guest);
    // Oturumsuz misafire indirim yok -- `resolveDiscount` ile ayni.
    const known = !!guest.userId;
    if (r.ok && r.discountPct > 0 && known) {
      const a = applyReferralDiscount(subtotal, r.discountPct);
      referral = { code: r.code, amount: a.discountAmount, total: a.totalPrice };
    } else referralStatus = r.ok ? "invalid" : r.reason;
  }
  return { coupon, couponStatus, minPrice, referral, referralStatus };
}

function affiliateCandidate(aff: ResolvedAffiliate | null, subtotal: number): Candidate | null {
  if (aff?.kind !== "ok" || aff.amount <= 0) return null;
  const a = applyAffiliateGuestDiscount(subtotal, aff.attribution.guestDiscountRate);
  return { code: aff.attribution.code, amount: a.discountAmount, total: a.totalPrice };
}

export class CheckoutDiscountService {
  /** Rezervasyon aninda: kazanan kuponsa hakki ALINIR; alinamazsa kalan adaylarla yeniden secilir. */
  async claim(input: {
    subtotal: number;
    couponCode?: string;
    referralCode?: string;
    affiliateCode?: string | null;
    guest: ReferralGuest;
    channel?: CheckoutChannel;
  }): Promise<CheckoutDiscountClaim> {
    const { guest } = input;
    const app = await resolveAppDiscount(input.channel, input.subtotal);
    const subtotal = app.totalPrice;
    input = { ...input, subtotal };
    const aff = await resolveAffiliate(input.affiliateCode, guest, subtotal);
    const attribution = aff?.kind === "ok" ? aff.attribution : null;
    const base: CheckoutDiscountClaim = {
      totalPrice: subtotal,
      appDiscountAmount: app.discountAmount,
      appDiscountPct: app.pct,
      couponDiscountAmount: 0,
      referralDiscountAmount: 0,
      affiliateDiscountAmount: 0,
      affiliateCode: attribution?.code,
      affiliate: attribution,
    };
    const affiliate = affiliateCandidate(aff, subtotal);
    /*
      Araci indirimi yoksa karsilastirilacak bir sey yok: kupon dogrudan claim
      edilir (kuralin eski hali, onizleme sorgusu yok). Varsa kupon tutari
      onizlemeyle olculur ki kota kaybeden indirim icin yanmasin.
    */
    const c = affiliate
      ? await gatherCandidates(input)
      : input.couponCode
        ? { coupon: { code: input.couponCode, amount: 0, total: subtotal }, referral: null as Candidate | null }
        : await gatherCandidates(input);
    let winner = chooseSingleDiscount({ coupon: c.coupon, referral: c.referral, affiliate });

    if (winner === "coupon" && input.couponCode) {
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
      // Kota yarista bitti: kupon yokmus gibi davet adayi da yeniden sorulur.
      const rest = await gatherCandidates({ ...input, couponCode: undefined });
      c.referral = rest.referral;
      winner = chooseSingleDiscount({ coupon: null, referral: c.referral, affiliate });
    }
    if (winner === "referral" && c.referral) {
      return { ...base, totalPrice: c.referral.total, referralDiscountAmount: c.referral.amount, referredByCode: c.referral.code };
    }
    if (winner === "affiliate" && affiliate) {
      return { ...base, totalPrice: affiliate.total, affiliateDiscountAmount: affiliate.amount };
    }
    return base;
  }

  /**
   * Onizleme: kota ALINMAZ, karar `claim` ile ayni secicidan. Mobil tek "indirim
   * kodu" alani gonderir: o kod hem kupon hem davet kodu olarak denenir.
   */
  async preview(input: {
    subtotal: number;
    code?: string;
    couponCode?: string;
    referralCode?: string;
    affiliateCode?: string | null;
    guest: ReferralGuest;
    channel?: CheckoutChannel;
  }): Promise<{
    total: number;
    appDiscount: { pct: number; amount: number } | null;
    discount: { kind: "coupon" | "referral" | "affiliate"; code: string; amount: number } | null;
    codeStatus: CodeStatus;
    minPrice: number | null;
    affiliate: AffiliateQuote | null;
  }> {
    const { guest } = input;
    const app = await resolveAppDiscount(input.channel, input.subtotal);
    const subtotal = app.totalPrice;
    const couponCode = input.couponCode ?? input.code;
    const referralCode = input.referralCode ?? input.code;
    const aff = await resolveAffiliate(input.affiliateCode, guest, subtotal);
    const affiliate = affiliateCandidate(aff, subtotal);
    const c = await gatherCandidates({ subtotal, couponCode, referralCode, guest });
    const winner = chooseSingleDiscount({ coupon: c.coupon, referral: c.referral, affiliate });
    const codeValid = !!(c.coupon ?? c.referral);
    // Tek kod alaninda kupon reddi (min_price) davet reddinden once gelir.
    const rejected: CodeStatus = c.couponStatus === "min_price" ? "min_price" : (c.referralStatus ?? c.couponStatus);
    const picked = winner === "coupon" ? c.coupon : winner === "referral" ? c.referral : winner === "affiliate" ? affiliate : null;
    return {
      total: picked ? picked.total : subtotal,
      appDiscount: app.discountAmount > 0 ? { pct: app.pct, amount: app.discountAmount } : null,
      discount: picked && winner ? { kind: winner, code: picked.code, amount: picked.amount } : null,
      codeStatus: winner === "affiliate" ? (codeValid ? "not_combinable" : rejected) : codeValid ? "applied" : rejected,
      minPrice: c.minPrice,
      affiliate: affiliateQuote(aff, winner === "affiliate"),
    };
  }
}

export const checkoutDiscountService = new CheckoutDiscountService();
