import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { Metadata } from "next";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { alternatesForPath } from "@/lib/seo-alternates";
import { TrendingUp, LayoutDashboard, MapPin, Clock, BadgePercent } from "lucide-react";
import { getPricingRules } from "@/lib/platform-settings";
import { getEffectiveCommission } from "@/lib/commission";
import PartnerEarningsCalculator from "@/components/guest/PartnerEarningsCalculator";
import prisma from "@/lib/db";
import { OPERATING_SHOP_FILTER } from "@/lib/public-shop-filter";
import { Users } from "lucide-react";
import { socialMetadata } from "@/lib/social-metadata";

/** Sosyal kanıt için gerçek sayı bu eşiğin altındaysa "ilk ortaklardan olun"
 * çerçevesi kullanılır — küçük bir rakamı olduğu gibi göstermek ikna edici
 * değil, ama uydurma bir sayı da yazılmaz (bu kod tabanında defalarca
 * düzeltilen "gerçekleşmeyen vaat" hatasının aynısı olurdu). */
const SOCIAL_PROOF_MIN_COUNT = 5;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "MarketingBecomePartner" });
  const base = getSiteBaseUrl();
  const title = t("metaTitle");
  const description = t("heroSubtitle");
  return {
    title,
    description,
    alternates: alternatesForPath(locale, "/become-partner"),
    ...socialMetadata({
      url: `${base}/${locale}/become-partner`,
      title,
      description,
    }),
  };
}

export default async function BecomePartnerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("MarketingBecomePartner");
  const pricingRules = await getPricingRules();
  /*
    YURURLUKTEKI oran. Ayarda %50 yaziyor ama platform su an tahsilat yapmiyor
    (`manual` saglayici) -- yani esnaftan kesilen bir sey yok. Hesaplayici
    ayardaki orani gosterirken, kazanmaya calistigi esnafa var olmayan bir %50
    komisyon vaat ediyordu. Bkz. `platform-split.ts` -> `effectiveCommissionRate`.
  */
  const { merchantShareRatio, rate: commissionRate } = await getEffectiveCommission();
  /**
   * OPERATING: burada esnafa "şu kadar ortağımız var" deniyor. Talep testi
   * noktalarının sahibi platformun kendisi (`prelaunch@bagajpark.com`), ortak
   * değil — onları saymak, aşağıdaki eşik mantığının önlemeye çalıştığı şeyin
   * ta kendisi olurdu: gerçek olmayan bir sosyal kanıt.
   */
  const activePartnerCount = await prisma.shop.count({ where: OPERATING_SHOP_FILTER });

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b border-gray-100 bg-orange-50/40 px-6 py-20 text-center">
        <h1 className="text-4xl font-black tracking-tight md:text-5xl">
          {t("heroTitle")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
          {t("heroSubtitle")}
        </p>
        <div className="mx-auto mt-6 flex w-fit flex-wrap items-center justify-center gap-2">
          <span className="flex items-center gap-2 rounded-full border border-orange-100 bg-white px-4 py-2 text-xs font-bold text-orange-700 shadow-sm">
            <Users size={14} />
            {activePartnerCount >= SOCIAL_PROOF_MIN_COUNT
              ? t("socialProofActive", { count: activePartnerCount })
              : t("socialProofEarly")}
          </span>
          {/*
            KOMİSYONSUZ DÖNEM ROZETİ — esnafı ikna eden asıl cümle bu.

            Platform şu an tahsilat yapmıyor (`manual` sağlayıcı), dolayısıyla
            komisyon da alamıyor; oran `effectiveCommissionRate` ile 0'a düşüyor.
            Bu rozet o gerçeği söylüyor ve PSP bağlandığı gün — oran yürürlüğe
            girdiğinde — KENDİLİĞİNDEN kayboluyor. Elle geri alınacak bir vaat
            değil, durumun görüntüsü.
          */}
          {commissionRate === 0 && (
            <span className="flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 shadow-sm">
              <BadgePercent size={14} />
              {t("zeroCommissionBadge")}
            </span>
          )}
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            href="/partners"
            className="rounded-2xl bg-orange-600 px-8 py-4 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-orange-600/25 hover:bg-orange-700"
          >
            {t("ctaPrimary")}
          </Link>
          <Link
            href="/partners"
            className="rounded-2xl border border-gray-200 bg-white px-8 py-4 text-sm font-black uppercase tracking-wider text-gray-800 hover:border-orange-200"
          >
            {t("ctaSecondary")}
          </Link>
          {/*
            Talep haritası buraya bağlanıyor çünkü bir esnafı ikna eden şey
            "ortağımız olun" cümlesi değil, KENDİ SEMTİNDE ölçülmüş talep.
            Sayfa zaten o ölçümü gösteriyor; buraya bağlanmadan yalnızca
            prelaunch nokta sayfalarından ulaşılabiliyordu — yani esnafın
            geldiği yerden değil.
          */}
          <Link href="/demand" className="btn-ui btn-ui-lg btn-ui-secondary">
            {t("ctaDemandMap")}
          </Link>
        </div>
        <p className="mx-auto mt-6 flex w-fit items-center gap-2 text-xs font-bold text-gray-400">
          <Clock size={14} />
          {t("approvalTimeNote")}
        </p>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-3">
          <div className="rounded-3xl border border-gray-100 bg-gray-50/80 p-8">
            <TrendingUp className="text-orange-600" size={32} />
            <h2 className="mt-4 text-lg font-black">{t("b1Title")}</h2>
            <p className="mt-2 text-sm text-gray-600">{t("b1Body")}</p>
          </div>
          <div className="rounded-3xl border border-gray-100 bg-gray-50/80 p-8">
            <LayoutDashboard className="text-orange-600" size={32} />
            <h2 className="mt-4 text-lg font-black">{t("b2Title")}</h2>
            <p className="mt-2 text-sm text-gray-600">{t("b2Body")}</p>
          </div>
          <div className="rounded-3xl border border-gray-100 bg-gray-50/80 p-8">
            <MapPin className="text-orange-600" size={32} />
            <h2 className="mt-4 text-lg font-black">{t("b3Title")}</h2>
            <p className="mt-2 text-sm text-gray-600">{t("b3Body")}</p>
          </div>
        </div>

        <section className="mt-16 rounded-3xl border border-orange-100 bg-orange-50/50 p-10 text-center">
          <h2 className="text-xl font-black">{t("calcTitle")}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-gray-600">
            {t("calcBody")}
          </p>
          <div className="mt-8">
            <PartnerEarningsCalculator
              defaultPricePerDay={pricingRules.defaultPricePerDay}
              merchantShareRatio={merchantShareRatio}
              locale={locale}
              labels={{
                capacityLabel: t("calcCapacityLabel"),
                occupancyLabel: t("calcOccupancyLabel"),
                monthlyEarningsLabel: t("calcMonthlyEarningsLabel"),
                disclaimer: t("calcDisclaimer"),
              }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
