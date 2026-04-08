import { setRequestLocale, getTranslations } from "next-intl/server";
import { Mail, MessageCircle, MapPin } from "lucide-react";

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Contact");

  return (
    <div className="min-h-screen bg-white font-sans pt-32 pb-20 px-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-20">
          <h1 className="text-5xl font-black tracking-tighter text-gray-900 mb-6">{t("title")}</h1>
          <p className="text-xl font-bold text-gray-400 max-w-xl leading-relaxed">{t("subtitle")}</p>
        </header>

        <div className="flex flex-col gap-10">
          <div className="bg-gray-50 flex flex-col items-center justify-center p-12 md:p-20 rounded-[3rem] border border-gray-100 shadow-sm text-center group transition-all hover:bg-orange-50/30">
            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl shadow-green-200/50 group-hover:scale-110 transition-transform">
              <MessageCircle size={48} />
            </div>
            <h2 className="text-3xl font-black text-gray-900 mb-4">{t("whatsappTitle")}</h2>
            <p className="text-lg font-bold text-gray-500 max-w-lg mb-10 leading-relaxed">
              Bizimle en hızlı şekilde iletişime geçmek için doğrudan WhatsApp destek hattımızı kullanabilirsiniz. Ekibimiz anında yanıt verecektir.
            </p>
            <a
              href="https://wa.me/905422415597"
              target="_blank"
              rel="noreferrer"
              className="px-10 py-5 bg-green-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-green-600 transition-all shadow-xl shadow-green-500/30 w-full sm:w-auto"
            >
              <MessageCircle size={20} />
              WHATSAPP&apos;TAN YAZ
            </a>
            <p className="mt-6 text-sm font-bold text-gray-400">
              <span className="text-gray-900">+90 542 241 55 97</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-center gap-6 p-10 rounded-[2.5rem] bg-white border border-gray-100 shadow-sm group">
              <div className="w-16 h-16 bg-gray-900 text-white rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Mail size={32} />
              </div>
              <div>
                <h4 className="text-xl font-black text-gray-900 mb-1">{t("emailTitle")}</h4>
                <p className="font-bold text-gray-400 text-sm mb-2">{t("emailSubtitle")}</p>
                <a
                  href={`mailto:${t("emailAddress")}`}
                  className="text-gray-900 font-black text-xs uppercase tracking-widest underline decoration-2 underline-offset-4 decoration-gray-200"
                >
                  {t("emailAddress")}
                </a>
              </div>
            </div>

            <div className="flex items-center gap-6 p-10 rounded-[2.5rem] bg-white border border-gray-100 shadow-sm group">
              <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <MapPin size={32} />
              </div>
              <div>
                <h4 className="text-xl font-black text-gray-900 mb-1">{t("opsTitle")}</h4>
                <p className="font-bold text-gray-400 text-sm mb-2">{t("opsAddress")}</p>
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest leading-none">
                  {t("opsBadge")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
