import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { alternatesForPath } from "@/lib/seo-alternates";
import { getGuestStaticSeo } from "@/lib/guest-static-seo";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { MessageCircle, Mail, MapPin, MessageSquare } from "lucide-react";
import ContactFormClient from "@/components/ContactFormClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { title, description } = getGuestStaticSeo(locale, "contact");
  const base = getSiteBaseUrl();
  return {
    title,
    description,
    alternates: alternatesForPath(locale, "/contact"),
    openGraph: { title, description, url: `${base}/${locale}/contact` },
  };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Contact");

  return (
    <div className="min-h-screen bg-gray-50/50">
      <header className="py-24 px-6 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-orange-600 rounded-[2rem] flex items-center justify-center text-white shadow-xl shadow-orange-200 mb-8 rotate-3">
            <MessageSquare size={32} />
          </div>
          <h1 className="text-5xl font-black text-gray-900 tracking-tighter mb-4">
            {t("title")}
          </h1>
          <p className="text-gray-400 font-bold text-lg max-w-xl">
            {t("subtitle")}
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-24 px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Info cards */}
          <div className="flex flex-col gap-6 order-2 lg:order-1">
            <div className="group p-10 bg-white rounded-[3rem] border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-orange-200/20 transition-all">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 shrink-0">
                  <MessageCircle size={32} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-black text-gray-900 mb-1">{t("whatsappTitle")}</h3>
                  <p className="text-gray-400 font-bold text-sm mb-6">{t("whatsappSubtitle")}</p>
                  <a href="https://wa.me/905422415597" target="_blank" className="h-12 inline-flex items-center px-8 bg-green-500 hover:bg-green-600 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-green-100">
                    {t("whatsappCta")}
                  </a>
                </div>
              </div>
            </div>

            <div className="group p-10 bg-white rounded-[3rem] border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-blue-200/20 transition-all">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0">
                  <Mail size={32} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-black text-gray-900 mb-1">{t("emailTitle")}</h3>
                  <p className="text-gray-400 font-bold text-sm mb-1">{t("emailSubtitle")}</p>
                  <a href="mailto:destek@bagajpark.com" className="text-lg font-black text-blue-600 hover:underline">
                    {t("emailAddress")}
                  </a>
                </div>
              </div>
            </div>

            <div className="group p-10 bg-white rounded-[3rem] border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-orange-200/20 transition-all">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 shrink-0">
                  <MapPin size={32} />
                </div>
                <div className="flex-1">
                  <div className="inline-flex px-2 py-0.5 bg-orange-100 text-orange-600 text-[8px] font-black uppercase tracking-widest rounded mb-2">
                    {t("opsBadge")}
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-1">{t("opsTitle")}</h3>
                  <p className="text-gray-400 font-bold text-sm leading-relaxed">
                    {t("opsAddress")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <ContactFormClient
            labels={{
              formTitle: t("formTitle"),
              name: t("name"),
              email: t("email"),
              message: t("message"),
              send: t("send"),
              success: t("success"),
              error: t("error"),
            }}
            responseNote="Genelde 2 saat içinde yanıt veriyoruz."
          />
        </div>
      </main>
    </div>
  );
}
