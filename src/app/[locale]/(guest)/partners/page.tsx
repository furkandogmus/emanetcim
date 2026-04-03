import { setRequestLocale, getTranslations } from "next-intl/server";
import { Store, TrendingUp, Users, ShieldCheck, Zap, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/routing";

export default async function PartnersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("PartnersPage");

  const benefits = [
    { title: t('benefit1Title'), desc: t('benefit1Desc'), icon: <Zap size={24} /> },
    { title: t('benefit2Title'), desc: t('benefit2Desc'), icon: <Users size={24} /> },
    { title: t('benefit3Title'), desc: t('benefit3Desc'), icon: <ShieldCheck size={24} /> },
  ];

  return (
    <div className="min-h-screen bg-white font-sans pt-32 pb-20 px-6">
      <div className="max-w-5xl mx-auto">
        
        {/* Hero Section */}
        <header className="mb-24 text-center">
           <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-full mb-6">
              <TrendingUp size={16} />
              <span className="text-xs font-black uppercase tracking-widest leading-none">Ek Gelir Kapısı</span>
           </div>
           <h1 className="text-6xl font-black tracking-tighter text-gray-900 mb-8 max-w-2xl mx-auto">
              {t('title')}
           </h1>
           <p className="text-xl font-bold text-gray-400 max-w-xl mx-auto leading-relaxed">
              {t('subtitle')}
           </p>
        </header>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-32">
           {benefits.map((benefit, i) => (
             <div key={i} className="p-10 bg-gray-50 rounded-[3rem] border border-gray-100 flex flex-col gap-6 group hover:translate-y-[-8px] transition-all duration-500 hover:shadow-2xl hover:shadow-gray-200">
                <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-all">
                   {benefit.icon}
                </div>
                <div>
                   <h3 className="text-2xl font-black text-gray-900 mb-2 uppercase tracking-tight">{benefit.title}</h3>
                   <p className="font-bold text-gray-400 leading-relaxed text-sm">
                      {benefit.desc}
                   </p>
                </div>
             </div>
           ))}
        </div>

        {/* How it Works / CTA */}
        <div className="relative p-12 md:p-20 bg-gray-900 text-white rounded-[4rem] overflow-hidden flex flex-col items-start gap-10">
           <div className="absolute top-0 right-0 w-96 h-96 bg-orange-600/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
           
           <div className="max-w-xl relative z-10">
              <h2 className="text-4xl font-black mb-6 uppercase tracking-tight">{t('howItWorks')}</h2>
              <ul className="flex flex-col gap-6 mb-12">
                 {[
                   "Başvurunuzu yapın ve dükkanınızı ücretsiz sisteme kaydedin.",
                   "Onaylanan dükkanınıza mühür ve tanıtım malzemelerinizi gönderelim.",
                   "Gelen turistlerin valizlerini mühürleyip sisteme kaydedin, anında kazanmaya başlayın."
                 ].map((step, i) => (
                   <li key={i} className="flex gap-4 items-start">
                      <div className="w-6 h-6 rounded-full bg-orange-600 text-[10px] font-black flex items-center justify-center shrink-0 mt-1">0{i+1}</div>
                      <p className="font-bold opacity-60 leading-relaxed">{step}</p>
                   </li>
                 ))}
              </ul>
              <Link href="/contact" className="inline-flex h-20 px-12 bg-white text-gray-900 rounded-[2rem] font-black text-sm uppercase tracking-widest items-center gap-4 hover:bg-orange-600 hover:text-white transition-all shadow-2xl">
                 {t('joinUs')}
                 <ChevronRight size={20} />
              </Link>
           </div>
           
           <div className="hidden md:block absolute bottom-12 right-12 opacity-10 grayscale">
              <Store size={240} strokeWidth={1} />
           </div>
        </div>

      </div>
    </div>
  );
}
