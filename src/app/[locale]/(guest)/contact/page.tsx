import { getTranslations, setRequestLocale } from "next-intl/server";
import { MessageCircle, Mail, MapPin, Send, MessageSquare } from "lucide-react";

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
          <div className="bg-white rounded-[4rem] p-12 border border-gray-100 shadow-2xl shadow-gray-200/50 order-1 lg:order-2">
            <h2 className="text-3xl font-black text-gray-900 mb-8 tracking-tight">{t("formTitle")}</h2>
            <form className="flex flex-col gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">{t("name")}</label>
                <input required type="text" className="w-full h-14 px-6 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:bg-white transition-all font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">{t("email")}</label>
                <input required type="email" className="w-full h-14 px-6 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:bg-white transition-all font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">{t("message")}</label>
                <textarea required rows={4} className="w-full p-6 bg-gray-50 border-none rounded-[2rem] focus:ring-4 focus:ring-orange-500/10 focus:bg-white transition-all font-bold resize-none" />
              </div>
              <button disabled className="h-16 w-full bg-gray-900 hover:bg-orange-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 group">
                <Send size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                {t("send")}
              </button>
              <p className="text-[10px] text-gray-400 text-center font-bold uppercase tracking-wider mt-2">
                Genelde 2 saat içinde yanıt veriyoruz.
              </p>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
