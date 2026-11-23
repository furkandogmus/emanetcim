import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { safeAffiliateRedirectPath } from "@/lib/affiliate-link";
import { AFFILIATE_COOKIE, AFFILIATE_COOKIE_MAX_AGE_S, affiliateService } from "@/services/AffiliateService";
import logger from "@/lib/logger";

/**
 * Araci linki: `/r/<KOD>` (dil oneki yoksa proxy `/tr/r/<KOD>`ye yonlendirir).
 *
 * Kod ACTIVE ise tiklama sayilir ve 30 gunluk birinci taraf cerez yazilir
 * (son tiklama kazanir). Gecersiz / bekleyen / durdurulmus kodda cerez
 * yazilmaz ama misafir yine siteye gelir: kirik link misafiri kaybettirmesin.
 * Hedef `?to=` yalnizca site ici yol olabilir (`safeAffiliateRedirectPath`).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ locale: string; code: string }> }) {
  const { locale, code } = await ctx.params;
  const target = safeAffiliateRedirectPath(req.nextUrl.searchParams.get("to"), locale);
  // Goreli Location: nginx arkasinda `req.url` ic adresi tasiyabilir.
  const res = new NextResponse(null, { status: 302, headers: { Location: target, "Cache-Control": "no-store" } });

  let accepted: string | null = null;
  try {
    accepted = await affiliateService.recordClick(decodeURIComponent(code));
  } catch (err) {
    logger.error({ err }, "affiliate_link_resolve_failed");
  }
  if (accepted) {
    res.cookies.set(AFFILIATE_COOKIE, accepted, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: AFFILIATE_COOKIE_MAX_AGE_S,
    });
  }
  return res;
}
