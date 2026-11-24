import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { resolvePartnerShops } from "@/lib/partner-shop";
import { signPosterLinkToken } from "@/lib/poster-link-token";
import { getSiteBaseUrl } from "@/lib/site-base-url";
import { APP_LOCALES, DEFAULT_APP_LOCALE, type AppLocale } from "@/i18n/locales";
import { toMobilePosterLink } from "@/lib/mobile-dto";

/**
 * Uygulamanin "QR afisi" dugmesi: web panelindeki afisin oturumsuz, kisa
 * omurlu bagi. Sahiplik web sayfasiyla ayni kuraldan (`resolvePartnerShops`):
 * baska dukkanin kimligi gelirse esnafin kendi dukkanina duser.
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["PARTNER"]);
  if (forbid) return forbid;

  const { activeShop } = await resolvePartnerShops(auth.user.id, req.nextUrl.searchParams.get("shop"));
  if (!activeShop) return NextResponse.json({ error: "no_shop" }, { status: 404 });

  // Uygulamanin ru dili webde yok: desteklenmeyen dil varsayilana duser.
  const asked = req.nextUrl.searchParams.get("locale") ?? "";
  const locale: AppLocale = (APP_LOCALES as readonly string[]).includes(asked)
    ? (asked as AppLocale)
    : DEFAULT_APP_LOCALE;

  const { token, expiresAt } = await signPosterLinkToken(activeShop.id);
  const url = `${getSiteBaseUrl()}/${locale}/poster?t=${encodeURIComponent(token)}`;
  return NextResponse.json(toMobilePosterLink(url, expiresAt), {
    headers: { "Cache-Control": "no-store" },
  });
}
