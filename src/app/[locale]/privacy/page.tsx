import { getTranslations, setRequestLocale } from "next-intl/server";
import { Lock, ShieldCheck } from "lucide-react";

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Privacy");

  return (
    <div className="min-h-screen bg-gray-50/30">
      <header className="py-24 px-6 bg-white border-b border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-600 via-orange-400 to-orange-600" />
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-20 h-20 bg-orange-50 rounded-[2.5rem] flex items-center justify-center text-orange-600 mx-auto mb-8 shadow-sm">
            <Lock size={36} />
          </div>
          <h1 className="text-5xl font-black text-gray-900 tracking-tighter mb-4">
            {t("title")}
          </h1>
          <p className="text-gray-400 font-bold text-lg">
            {t("lastUpdated")}
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-24 px-6">
        <div className="space-y-12">
          <div className="p-10 bg-white rounded-[3rem] border border-gray-100 shadow-sm flex items-start gap-8">
            <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 shrink-0">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 mb-2">{t("commitmentTitle")}</h2>
              <p className="text-gray-500 font-medium leading-relaxed">
                {t("commitmentBody")}
              </p>
            </div>
          </div>

          {[1, 2, 3, 4, 5, 6].map((idx) => {
            const qKey = `q${idx}`;
            const aKey = `a${idx}`;
            return (
              <section key={idx} className="group p-10 hover:bg-white rounded-[3rem] transition-all border border-transparent hover:border-gray-100 hover:shadow-xl hover:shadow-gray-200/40">
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-4xl font-black text-orange-600/10 group-hover:text-orange-600/20 transition-colors">
                    {idx.toString().padStart(2, '0')}
                  </span>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {t(qKey as any)}
                  </h3>
                </div>
                <div className="text-gray-500 font-medium leading-relaxed pl-14">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {t(aKey as any)}
                </div>
              </section>
            );
          })}
        </div>

        <div className="mt-20 p-12 bg-gray-900 rounded-[3rem] text-center text-white">
          <h3 className="text-xl font-black mb-4">Gizlilik Sorularınız İçin</h3>
          <p className="text-gray-400 font-bold mb-8">Veri işleme süreçlerimizle ilgili her türlü sorunuz için bize ulaşın.</p>
          <a href="mailto:privacy@bagajpark.com" className="inline-flex h-14 items-center px-10 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all">
            privacy@bagajpark.com
          </a>
        </div>
      </main>
    </div>
  );
}
