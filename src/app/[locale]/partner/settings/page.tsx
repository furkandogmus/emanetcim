import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Link } from "@/i18n/routing";
import { auth } from "@/auth";
import { shopService } from "@/services/ShopService";
import { redirect } from "next/navigation";
import PartnerShopSettingsForm from "@/components/partner/PartnerShopSettingsForm";
import { moneyToNumber } from "@/lib/money";
import { getPricingRules } from "@/lib/platform-settings";

/**
 * Partner Settings — DB ile senkron (PartnerClient AYARLAR ile aynı aksiyon)
 */
export default async function PartnerSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Partner");

  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}/partner/settings`)}`
    );
  }
  if (session.user.role !== "PARTNER" && session.user.role !== "ADMIN") {
    redirect(`/${locale}`);
  }

  const [shops, pricingRules] = await Promise.all([
    shopService.getShopsByOwner(session.user.id),
    getPricingRules(),
  ]);
  const shop = shops[0];
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
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans pb-24">
      <header className="p-6 bg-white border-b border-gray-100 flex items-center gap-4 sticky top-0 z-10">
        <Link
          href="/partner"
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-xl font-black tracking-tight">{t("settings")}</h1>
      </header>

      <main className="p-6 max-w-2xl mx-auto w-full">
        <PartnerShopSettingsForm
          shopId={shop.id}
          initialCapacity={shop.capacity}
          initialOpening={shop.openingTime || "09:00"}
          initialClosing={shop.closingTime || "20:00"}
          initialPricePerDay={moneyToNumber(shop.pricePerDay) || marketPrice}
          marketPrice={marketPrice}
        />
      </main>
    </div>
  );
}
