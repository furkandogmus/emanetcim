import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Link } from "@/i18n/routing";
import { requirePartnerPage } from "@/lib/page-auth";
import { resolvePartnerShops } from "@/lib/partner-shop";
import PartnerShopSettingsForm from "@/components/partner/PartnerShopSettingsForm";
import { moneyToNumber } from "@/lib/money";
import { getPricingRules } from "@/lib/platform-settings";
import prisma from "@/lib/db";

/**
 * Partner Settings — DB ile senkron (PartnerClient AYARLAR ile aynı aksiyon)
 */
export default async function PartnerSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ shop?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Partner");
  const tCommon = await getTranslations("Common");

  const actor = await requirePartnerPage(locale, "/partner/settings");

  const sp = (await searchParams) ?? {};
  const [{ activeShop: shopRef }, pricingRules, ownerPhoneRow] = await Promise.all([
    resolvePartnerShops(actor.id, sp.shop),
    getPricingRules(),
    prisma.user.findUnique({
      where: { id: actor.id },
      select: { phone: true },
    }),
  ]);
  const shop = shopRef
    ? await prisma.shop.findUnique({
        where: { id: shopRef.id },
        select: {
          id: true,
          capacity: true,
          openingTime: true,
          closingTime: true,
          pricePerDay: true,
          address: true,
          city: true,
          district: true,
          latitude: true,
          longitude: true,
        },
      })
    : null;
  const marketPrice = pricingRules.defaultPricePerDay;

  if (!shop) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-10 text-center">
        <h1 className="text-2xl font-black text-gray-900 mb-4">
          {t("noShopTitle")}
        </h1>
        <Link
          href="/partner"
          className="text-orange-600 font-bold underline"
        >
          {t("backToPanel")}
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 flex flex-col font-sans pb-24">
      <header className="p-6 bg-white border-b border-gray-100 flex items-center gap-4 sticky top-0 z-10">
        <Link
          href="/partner"
          aria-label={tCommon("back")}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-xl font-black tracking-tight">{t("settings")}</h1>
      </header>

      <div className="p-6 max-w-2xl mx-auto w-full space-y-6">
        <PartnerShopSettingsForm
          shopId={shop.id}
          initialCapacity={shop.capacity}
          initialOpening={shop.openingTime || "09:00"}
          initialClosing={shop.closingTime || "20:00"}
          initialPricePerDay={moneyToNumber(shop.pricePerDay) || marketPrice}
          initialAddress={shop.address ?? ""}
          initialCity={shop.city ?? ""}
          initialDistrict={shop.district ?? ""}
          initialLatitude={shop.latitude ?? null}
          initialLongitude={shop.longitude ?? null}
          marketPrice={marketPrice}
          initialPhone={ownerPhoneRow?.phone ?? ""}
        />
      </div>
    </div>
  );
}
