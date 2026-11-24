import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import prisma from "@/lib/db";
import { requirePartnerPage } from "@/lib/page-auth";
import { resolvePartnerShops } from "@/lib/partner-shop";
import ShopPosterView, { loadShopPoster } from "@/components/app-promo/ShopPosterView";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AppPoster" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function PartnerPosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ shop?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("AppPoster");
  const actor = await requirePartnerPage(locale, "/partner/poster");
  const sp = (await searchParams) ?? {};
  // `?shop=a&shop=b` dizi getirir; dizi Prisma'ya gidince 500 oluyordu.
  const shopParam = typeof sp.shop === "string" ? sp.shop : undefined;

  // Esnaf yalnizca kendi dukkanini gorur (`resolvePartnerShops` sahiplige bakar);
  // yonetici `?shop=` ile herhangi bir dukkanin afisini acabilir.
  const shop =
    actor.role === "ADMIN" && shopParam
      ? await prisma.shop.findUnique({ where: { id: shopParam }, select: { id: true, name: true } })
      : (await resolvePartnerShops(actor.id, shopParam)).activeShop;

  if (!shop) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-10">
        <p className="text-gray-500 font-bold">{t("noShop")}</p>
      </div>
    );
  }

  return <ShopPosterView {...await loadShopPoster(shop)} />;
}
