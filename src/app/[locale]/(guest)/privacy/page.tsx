import { setRequestLocale, getTranslations } from "next-intl/server";
import { Lock, Eye, Cookie, ShieldCheck } from "lucide-react";

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const tFooter = await getTranslations("Footer");
  const t = await getTranslations("Privacy");

  const dataTypes = [t("dataType1"), t("dataType2"), t("dataType3"), t("dataType4")];

  return (
    <div className="min-h-screen bg-white font-sans pt-32 pb-20 px-6">
      <div className="max-w-3xl mx-auto">
        <header className="mb-16">
          <div className="w-16 h-16 bg-gray-50 text-gray-900 rounded-[1.5rem] flex items-center justify-center mb-6">
            <Lock size={32} />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-gray-900 mb-4">{tFooter("privacy")}</h1>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-none">
            {t("lastUpdated")}
          </p>
        </header>

        <article className="prose prose-gray max-w-none flex flex-col gap-10 font-bold text-gray-500 leading-relaxed">
          <section>
            <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
              <ShieldCheck size={20} className="text-green-500" />
              {t("section1Title")}
            </h2>
            <p>{t("section1Body")}</p>
          </section>

          <section className="bg-gray-50 p-10 rounded-[3rem] border border-gray-100">
            <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-3">
              <Eye size={20} className="text-orange-600" />
              {t("section2Title")}
            </h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 list-none p-0">
              {dataTypes.map((item, i) => (
                <li
                  key={i}
                  className="bg-white p-4 rounded-xl text-xs font-bold text-gray-400 flex items-center gap-2"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
              <Cookie size={20} className="text-orange-600" />
              {t("section3Title")}
            </h2>
            <p>{t("section3Body")}</p>
          </section>
        </article>
      </div>
    </div>
  );
}
