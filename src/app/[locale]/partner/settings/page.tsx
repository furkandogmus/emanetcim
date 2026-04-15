import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import { Link } from "@/i18n/routing";
import { auth } from "@/auth";
import { shopService } from "@/services/ShopService";
import { redirect } from "next/navigation";
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
  searchParams?: Promise<Record<string, string>>;
}) {
  const { locale } = await params;
  const sp = searchParams ? await searchParams : {};
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

  const [shops, pricingRules, ownerPhoneRow] = await Promise.all([
    shopService.getShopsByOwner(session.user.id),
    getPricingRules(),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { phone: true },
    }),
  ]);
  const shop = shops[0];
  const marketPrice = pricingRules.defaultPricePerDay;
  const stripeConnected = !!shop?.stripeAccountId;
  const stripeConnectEnabled = !!process.env.STRIPE_CLIENT_ID;
  const stripeConnectedNow = sp.stripe_connected === "1";
  const stripeError = sp.stripe_error as string | undefined;

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

      <main className="p-6 max-w-2xl mx-auto w-full space-y-6">
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

        {/* Stripe Connect */}
        {stripeConnectEnabled && (
          <section className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-base font-bold text-gray-900 mb-1">Stripe Ödemeleri (Avrupa)</h2>
            <p className="text-sm text-gray-500 mb-4">
              Avrupa&apos;daki misafirlerden ödeme alabilmek için Stripe hesabınızı bağlayın.
            </p>

            {stripeConnectedNow && (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 mb-3">
                <CheckCircle2 size={16} />
                Stripe hesabınız başarıyla bağlandı!
              </div>
            )}
            {stripeError && (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2 mb-3">
                <AlertCircle size={16} />
                Stripe bağlantısı başarısız: {stripeError}
              </div>
            )}

            {stripeConnected ? (
              <div className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle2 size={16} />
                <span>Stripe hesabı bağlı</span>
                <span className="ml-auto text-gray-400 font-mono text-xs">{shop.stripeAccountId}</span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-html-link-for-pages
              <a
                href="/api/stripe/connect/authorize"
                className="inline-flex items-center gap-2 bg-[#635BFF] text-white font-semibold text-sm px-4 py-2 rounded-lg hover:bg-[#4f47e3] transition-colors"
              >
                <ExternalLink size={15} />
                Stripe Hesabını Bağla
              </a>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
