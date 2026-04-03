import { setRequestLocale, getTranslations } from "next-intl/server";
import { ShieldCheck, Heart, MapPin, Zap } from "lucide-react";

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("About");

  return (
    <div className="min-h-screen bg-white font-sans overflow-hidden pt-32 pb-20">
      <div className="max-w-4xl mx-auto px-6">
        
        {/* Hero Section */}
        <header className="mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 rounded-full mb-6">
            <ShieldCheck size={16} />
            <span className="text-xs font-black uppercase tracking-widest leading-none">Güven İnşa Ediyoruz</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-gray-900 mb-8 max-w-2xl leading-[0.9]">
            {t('title')}
          </h1>
          <p className="text-xl font-bold text-gray-400 leading-relaxed max-w-xl">
             Emanetçi, seyahat ederken yanınızdaki ağır yüklerden kurtulmanızı sağlayan, Türkiye'nin en yaygın yerel emanet ağıdır.
          </p>
        </header>

        {/* Vision & Mission */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-32">
          <div className="p-10 bg-gray-50 rounded-[3rem] border border-gray-100 flex flex-col gap-4">
             <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-orange-600">
               <Zap size={24} />
             </div>
             <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight">{t('vision')}</h3>
             <p className="font-bold text-gray-400 leading-relaxed">
                Türkiye'nin her köşesinde, her gezginin eşyasını güvenle bırakabileceği dijital bir emanet ağı oluşturmak.
             </p>
          </div>
          <div className="p-10 bg-gray-900 text-white rounded-[3rem] flex flex-col gap-4 shadow-2xl shadow-gray-200">
             <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-orange-500">
               <Heart size={24} />
             </div>
             <h3 className="text-2xl font-black uppercase tracking-tight">{t('mission')}</h3>
             <p className="font-bold opacity-40 leading-relaxed">
                Yerel esnafın atıl alanlarını teknolojiyle birleştirerek, turistlere özgürlük, esnafa ise ek gelir sağlamak.
             </p>
          </div>
        </div>

        {/* Core Values */}
        <div className="border-t border-gray-100 pt-20">
           <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-12 text-center">{t('whyUs')}</h3>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
              {[
                { title: "%100 Yerel", desc: "Esnafımızla el ele veriyoruz.", icon: <MapPin size={32} /> },
                { title: "Maksimum Güven", desc: "Mühürlü valiz sistemiyle tam koruma.", icon: <ShieldCheck size={32} /> },
                { title: "Kolay Kullanım", desc: "Saniyeler içinde rezervasyon yapın.", icon: <Zap size={32} /> }
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center gap-4">
                  <div className="p-6 bg-gray-50 rounded-3xl text-gray-900 group hover:bg-orange-600 hover:text-white transition-all cursor-default">
                    {item.icon}
                  </div>
                  <h4 className="text-lg font-black text-gray-900">{item.title}</h4>
                  <p className="text-sm font-bold text-gray-400 max-w-[180px]">{item.desc}</p>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
}
