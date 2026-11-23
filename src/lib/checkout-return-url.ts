/**
 * Checkout -> giris/kayit -> checkout donus adresi: secim (gunler, valizler,
 * kupon) URL'de tasinir, cunku e-posta dogrulama bagi ya da OAuth baska bir
 * sekmede acilabilir ve `localStorage` taslagi orada yoktur. Araci cerezi
 * (`bp_aff`, HttpOnly, `path=/`) giristen etkilenmez; burada tasinmaz.
 */
import { sanitizeAuthCallbackUrl, withAuthCallback } from "@/lib/auth-callback-url";
import { dateOnlyFromParam } from "@/lib/stay-days";

export type CheckoutSelection = {
  checkIn?: string | null;
  checkOut?: string | null;
  bagS?: number;
  bagM?: number;
  bagXl?: number;
  couponCode?: string | null;
};

/** Valiz sayisi ust siniri: mobil uc semasiyla ayni (`max(20)`). */
const MAX_BAGS_PER_SIZE = 20;
const MAX_COUPON_LENGTH = 64;

function bagCount(raw: unknown): number | undefined {
  if (typeof raw !== "string" || !/^\d{1,2}$/.test(raw)) return undefined;
  const n = Number(raw);
  return n <= MAX_BAGS_PER_SIZE ? n : undefined;
}

function couponParam(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const v = raw.trim();
  return v && v.length <= MAX_COUPON_LENGTH ? v : undefined;
}

/**
 * Checkout'a donus yolu: `/<dil>/checkout/<dukkan>?checkIn=..&checkOut=..&bagS=..`.
 * Her zaman ayni origin'de bir YOL uretir; sonuc `sanitizeAuthCallbackUrl`den
 * aynen gecer (testte sabit).
 */
export function buildCheckoutReturnPath(
  locale: string,
  shopId: string,
  sel: CheckoutSelection,
): string {
  const qs = new URLSearchParams();
  const checkIn = dateOnlyFromParam(sel.checkIn);
  const checkOut = dateOnlyFromParam(sel.checkOut);
  if (checkIn) qs.set("checkIn", checkIn);
  if (checkOut) qs.set("checkOut", checkOut);
  for (const [key, value] of [
    ["bagS", sel.bagS],
    ["bagM", sel.bagM],
    ["bagXl", sel.bagXl],
  ] as const) {
    const n = bagCount(value === undefined ? undefined : String(value));
    if (n !== undefined) qs.set(key, String(n));
  }
  const coupon = couponParam(sel.couponCode ?? undefined);
  if (coupon) qs.set("coupon", coupon);
  const query = qs.toString();
  const path = `/${encodeURIComponent(locale)}/checkout/${encodeURIComponent(shopId)}`;
  return sanitizeAuthCallbackUrl(query ? `${path}?${query}` : path);
}

/**
 * Giris/kayit sayfasina, donus yolu `callbackUrl` olarak eklenmis baglanti.
 * Donus yolu bir kez daha suzulur: cagiran ham bir deger verse de dis siteye
 * yonlendiren bir `callbackUrl` uretilmez.
 */
export function checkoutAuthHref(page: "login" | "register", returnPath: string): string {
  return withAuthCallback(`/${page}`, returnPath);
}

/** Checkout sayfasinin arama parametrelerinden dogrulanmis secim. */
export function parseCheckoutSelectionParams(
  sp: Record<string, string | string[] | undefined>,
): CheckoutSelection {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  /* Eski baglantilar (`?bags=N`) orta boy valiz sayisi tasir. */
  const legacyBags = bagCount(one("bags"));
  return {
    checkIn: dateOnlyFromParam(one("checkIn")),
    checkOut: dateOnlyFromParam(one("checkOut")),
    bagS: bagCount(one("bagS")),
    bagM: bagCount(one("bagM")) ?? legacyBags,
    bagXl: bagCount(one("bagXl")),
    couponCode: couponParam(one("coupon")) ?? null,
  };
}
