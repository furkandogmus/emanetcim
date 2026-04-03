import { setRequestLocale, getTranslations } from "next-intl/server";
import { HelpCircle, ChevronDown, ShieldCheck, CreditCard, Clock, Store } from "lucide-react";

export default async function FAQPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("FAQ");

  const faqs = [
    { q: t('q1'), a: t('a1'), icon: <ShieldCheck size={20} /> },
    { q: t('q2'), a: t('a2'), icon: <Clock size={20} /> },
    { q: t('q3'), a: t('a3'), icon: <CreditCard size={20} /> },
    { q: t('q4'), a: t('a4'), icon: <Store size={20} /> },
  ];

  return (
    <div className="min-h-screen bg-white font-sans pt-32 pb-20 px-6">
      <div className="max-w-3xl mx-auto">
        
        <header className="mb-20 text-center">
           <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <HelpCircle size={32} />
           </div>
           <h1 className="text-5xl font-black tracking-tighter text-gray-900 mb-4">{t('title')}</h1>
           <p className="text-xl font-bold text-gray-400">{t('subtitle')}</p>
        </header>

        <div className="flex flex-col gap-6">
           {faqs.map((faq, i) => (
             <details key={i} className="group bg-gray-50 rounded-[2rem] border border-gray-100 open:bg-white open:shadow-xl open:shadow-gray-200/50 transition-all duration-300">
                <summary className="flex items-center justify-between p-8 cursor-pointer list-none">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white shadow-sm rounded-xl flex items-center justify-center text-gray-400 group-open:text-orange-600 transition-colors">
                         {faq.icon}
                      </div>
                      <h3 className="text-lg font-black text-gray-900">{faq.q}</h3>
                   </div>
                   <ChevronDown size={20} className="text-gray-300 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-8 pb-8 text-gray-500 font-bold leading-relaxed border-t border-gray-50 pt-6">
                   {faq.a}
                </div>
             </details>
           ))}
        </div>

        <div className="mt-20 p-10 bg-gray-900 text-white rounded-[3rem] text-center shadow-2xl shadow-gray-200">
           <h3 className="text-2xl font-black mb-4 italic">Başka bir sorunuz mu var?</h3>
           <p className="font-bold opacity-40 mb-8">Operasyon ekibimiz 7/24 yanınızda.</p>
           <a href={`/${locale}/contact`} className="inline-flex h-16 px-10 bg-orange-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest items-center hover:bg-orange-500 transition-all">
              DESTEK MERKEZİNE GİT
           </a>
        </div>

      </div>
    </div>
  );
}
