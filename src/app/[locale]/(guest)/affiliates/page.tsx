import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { alternatesForPath } from "@/lib/seo-alternates";
import AffiliateApplyForm from "@/components/guest/AffiliateApplyForm";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Affiliate" });
  return { title: t("applyMetaTitle"), description: t("applyIntro"), alternates: alternatesForPath(locale, "/affiliates") };
}

/** "Araci ol": Airbnb ev sahibi, otel, rehber basvurusu. Kayit PENDING acilir, admin onaylar. */
export default async function AffiliateApplyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Affiliate");
  return (
    <div className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl id-display text-gray-900">{t("applyTitle")}</h1>
        <p className="mt-3 text-gray-600">{t("applyIntro")}</p>
        <ul className="mt-6 flex flex-col gap-2 text-sm text-gray-700">
          <li>{t("applyPoint1")}</li>
          <li>{t("applyPoint2")}</li>
          <li>{t("applyPoint3")}</li>
        </ul>
        <div className="id-surface mt-8 p-6">
          <AffiliateApplyForm />
        </div>
      </div>
    </div>
  );
}
