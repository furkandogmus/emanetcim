import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import prisma from "@/lib/db";
import { getClientIp } from "@/lib/client-ip";
import { rateLimit } from "@/lib/rate-limit";
import { verifyPosterLinkToken } from "@/lib/poster-link-token";
import ShopPosterView, { loadShopPoster } from "@/components/app-promo/ShopPosterView";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AppPoster" });
  // Bag oturumsuz ve token'li: arama motoruna da, yonlendirene de gitmez.
  return { title: t("metaTitle"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/**
 * Uygulamadan acilan afis (`GET /api/mobile/partner/poster` imzalar). Oturum
 * istemez: esnafin telefonundaki tarayicida web oturumu yoktur. Kapsam tek
 * dukkanin afisi, omur 15 dk; IP basina hiz siniri token tahminini de keser.
 */
export default async function SignedPosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ t?: string | string[] }>;
}) {
  const { locale } = await params;
  // Token sorguda, yolda degil: JWT nokta tasir ve noktali yol statik dosya sayilir (`proxy.ts`).
  const raw = ((await searchParams) ?? {}).t;
  const token = typeof raw === "string" ? raw : "";
  setRequestLocale(locale);
  const t = await getTranslations("PartnerParity");

  const ip = await getClientIp();
  if (!(await rateLimit(`poster_link:ip:${ip}`, 30, 10 * 60_000))) {
    return <PosterNotice title={t("posterRateLimitedTitle")} body={t("posterRateLimitedBody")} />;
  }

  const shopId = token ? await verifyPosterLinkToken(token) : null;
  const shop = shopId
    ? await prisma.shop.findUnique({ where: { id: shopId }, select: { id: true, name: true } })
    : null;
  if (!shop) {
    return <PosterNotice title={t("posterLinkExpiredTitle")} body={t("posterLinkExpiredBody")} />;
  }

  return <ShopPosterView {...await loadShopPoster(shop)} />;
}

function PosterNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-2 p-10 text-center">
      <h1 className="id-display text-xl text-gray-900">{title}</h1>
      <p className="max-w-sm text-gray-600">{body}</p>
    </div>
  );
}
