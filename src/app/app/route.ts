import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { APP_LOCALES } from "@/i18n/locales";
import { isRateLimited } from "@/lib/internal-api-guard";
import { resolveRequestLocale } from "@/lib/request-locale";
import {
  decideAppLink,
  detectAppPlatform,
  getAppStoreFlags,
  isBotUserAgent,
  normalizeAppLinkSource,
} from "@/lib/app-stores";
import { recordAppLinkHit } from "@/services/AppLinkService";

/**
 * Akilli indirme bagi: afis QR'i, e-posta ve site rozetleri buraya gelir.
 * Platformun magazasi yayindaysa 302 ile magazaya, degilse dilli acilis
 * sayfasina (`/<dil>/app`). Proxy bu yolu next-intl'e sokmaz (`proxy.ts`).
 *
 * Hicbir kosulda hata donmez: kayit ve hiz siniri yalnizca olcumu etkiler.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ua = req.headers.get("user-agent");
  const platform = detectAppPlatform(ua);
  const sp = req.nextUrl.searchParams;
  const source = normalizeAppLinkSource(sp.get("kaynak"), sp.get("utm_source"));

  const decision = decideAppLink(platform, await getAppStoreFlags());

  if (!isBotUserAgent(ua) && !(await isRateLimited(req, "app-link", 20, 60_000).catch(() => true))) {
    await recordAppLinkHit({ source, platform, outcome: decision.outcome });
  }

  const target =
    decision.outcome === "redirect"
      ? new URL(decision.url)
      : new URL(`/${pickLocale(req)}/app`, req.nextUrl.origin);
  if (decision.outcome === "landing" && source !== "direct") target.searchParams.set("kaynak", source);

  const res = NextResponse.redirect(target, 302);
  // Karar UA'ya ve bayraga bagli: ara bellek (nginx/CDN) bir kullanicinin kararini digerine vermesin.
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}

function pickLocale(req: NextRequest): string {
  const cookie = req.cookies.get("NEXT_LOCALE")?.value;
  if (cookie && (APP_LOCALES as readonly string[]).includes(cookie)) return cookie;
  return resolveRequestLocale(req.headers.get("accept-language"));
}
