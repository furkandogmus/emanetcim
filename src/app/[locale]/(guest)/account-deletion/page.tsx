import { getTranslations, setRequestLocale } from "next-intl/server";
import { Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { Link } from "@/i18n/routing";
import { alternatesForPath } from "@/lib/seo-alternates";
import { getGuestStaticSeo } from "@/lib/guest-static-seo";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { socialMetadata } from "@/lib/social-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { title, description } = getGuestStaticSeo(locale, "accountDeletion");
  const base = getSiteBaseUrl();
  return {
    title,
    description,
    alternates: alternatesForPath(locale, "/account-deletion"),
    ...socialMetadata({
      url: `${base}/${locale}/account-deletion`,
      title,
      description,
    }),
  };
}

/* Google Play hesap silme beyanindaki URL; giris istemeden okunabilmeli. */
export default async function AccountDeletionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("AccountDeletion");

  return (
    <div className="min-h-screen bg-gray-50/30">
      <header className="py-24 px-6 bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-20 h-20 bg-orange-50 rounded-4xl flex items-center justify-center text-orange-600 mx-auto mb-8">
            <Trash2 size={36} />
          </div>
          <h1 className="text-5xl font-black text-gray-900 tracking-tighter mb-4">{t("title")}</h1>
          <p className="text-gray-500 font-medium text-lg">{t("intro")}</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto py-16 px-6 space-y-8">
        <section className="p-8 bg-white rounded-4xl border border-gray-100">
          <h2 className="text-2xl font-black text-gray-900 mb-4">{t("appTitle")}</h2>
          <ol className="list-decimal pl-6 space-y-2 text-gray-600 font-medium">
            <li>{t("appStep1")}</li>
            <li>{t("appStep2")}</li>
          </ol>
        </section>

        <section className="p-8 bg-white rounded-4xl border border-gray-100">
          <h2 className="text-2xl font-black text-gray-900 mb-4">{t("webTitle")}</h2>
          <ol className="list-decimal pl-6 space-y-2 text-gray-600 font-medium">
            <li>{t("webStep1")}</li>
            <li>{t("webStep2")}</li>
          </ol>
          <Link href="/account/privacy" className="inline-block mt-4 text-orange-600 font-bold hover:underline">
            {t("webLink")}
          </Link>
          <p className="mt-6 text-gray-500 font-medium">
            {t("partnerNote")}{" "}
            <Link href="/contact" className="text-orange-600 font-bold hover:underline">
              {t("contactLink")}
            </Link>
          </p>
        </section>

        <section className="p-8 bg-white rounded-4xl border border-gray-100">
          <h2 className="text-xl font-black text-gray-900 mb-2">{t("deletedTitle")}</h2>
          <p className="text-gray-600 font-medium leading-relaxed">{t("deletedBody")}</p>
          <h2 className="text-xl font-black text-gray-900 mt-8 mb-2">{t("keptTitle")}</h2>
          <p className="text-gray-600 font-medium leading-relaxed">{t("keptBody")}</p>
        </section>
      </div>
    </div>
  );
}
