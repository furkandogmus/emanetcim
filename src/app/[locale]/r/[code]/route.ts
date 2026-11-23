import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { safeAffiliateRedirectPath } from "@/lib/affiliate-link";
import { AFFILIATE_COOKIE, AFFILIATE_COOKIE_MAX_AGE_S, affiliateService } from "@/services/AffiliateService";
import logger from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/internal-api-guard";

function withAffParam(path: string, code: string): string {
  const u = new URL(path, "https://internal.invalid");
  u.searchParams.set("aff", code);
  return u.pathname + u.search + u.hash;
}

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

  // IP basina sinir yalnizca SAYACI korur (bot sisirmesi); misafir yine yonlenir.
  const count = await rateLimit(`affiliate_click:ip:${clientIp(req)}`, 30, 10 * 60_000).catch(() => false);
  let accepted: string | null = null;
  try {
    accepted = await affiliateService.recordClick(decodeURIComponent(code), new Date(), { count });
  } catch (err) {
    logger.error({ err }, "affiliate_link_resolve_failed");
  }
  /*
    `aff=` hedefe eklenir: uygulama `/<dil>/shop/<id>?aff=KOD` baglantisini acarsa
    kodu odeme ekranina tasir. `ref=` kullanici davet koduna ait, ona dokunulmaz.
  */
  const location = accepted ? withAffParam(target, accepted) : target;
  // Goreli Location: nginx arkasinda `req.url` ic adresi tasiyabilir.
  const res = new NextResponse(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store" } });
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
