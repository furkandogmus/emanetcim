import { setRequestLocale, getTranslations } from "next-intl/server";
import { ShieldCheck, Scale, FileText, AlertTriangle } from "lucide-react";

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Terms");

  const forbidden = [
    t("forbidden1"),
    t("forbidden2"),
    t("forbidden3"),
    t("forbidden4"),
    t("forbidden5"),
    t("forbidden6"),
  ];

  return (
    <div className="min-h-screen bg-white font-sans pt-32 pb-20 px-6">
      <div className="max-w-3xl mx-auto">
        <header className="mb-16">
          <div className="w-16 h-16 bg-gray-50 text-gray-900 rounded-[1.5rem] flex items-center justify-center mb-6">
            <Scale size={32} />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-gray-900 mb-4">{t("pageTitle")}</h1>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-none">
            {t("lastUpdated")}
          </p>
        </header>

        <article className="prose prose-gray prose-headings:text-gray-900 prose-headings:font-black prose-p:text-gray-500 prose-strong:text-gray-900 max-w-none flex flex-col gap-10">
          <section>
            <h2 className="text-2xl font-black mb-4 flex items-center gap-3">
              <FileText size={20} className="text-orange-600" />
              {t("section1Title")}
            </h2>
            <p className="font-bold leading-relaxed">{t("section1Body")}</p>
          </section>

          <section className="bg-orange-50 p-8 rounded-[2rem] border border-orange-100">
            <h2 className="text-2xl font-black mb-4 flex items-center gap-3 text-orange-900">
              <ShieldCheck size={20} className="text-orange-600" />
              {t("section2Title")}
            </h2>
            <p className="text-orange-900/70 font-bold leading-relaxed">{t("section2Body")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-black mb-4 flex items-center gap-3">
              <AlertTriangle size={20} className="text-red-500" />
              {t("section3Title")}
            </h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 list-none p-0">
              {forbidden.map((item, i) => (
                <li
                  key={i}
                  className="bg-gray-50 p-4 rounded-xl text-xs font-bold text-gray-500 flex items-center gap-2"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </article>
      </div>
    </div>
  );
}
