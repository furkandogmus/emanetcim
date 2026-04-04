import { setRequestLocale, getTranslations } from "next-intl/server";
import { Mail, MessageCircle, MapPin, Send } from "lucide-react";

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Contact");

  return (
    <div className="min-h-screen bg-white font-sans pt-32 pb-20 px-6">
      <div className="max-w-4xl mx-auto">
        
        <header className="mb-20">
           <h1 className="text-5xl font-black tracking-tighter text-gray-900 mb-6">{t('title')}</h1>
           <p className="text-xl font-bold text-gray-400 max-w-xl leading-relaxed">
              {t('subtitle')}
           </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
           
           {/* Contact Form (Mock) */}
           <div className="bg-gray-50 p-10 rounded-[3rem] border border-gray-100 shadow-sm order-2 md:order-1">
              <h2 className="text-2xl font-black text-gray-900 mb-8 uppercase tracking-widest">{t('formTitle')}</h2>
              <form className="flex flex-col gap-6">
                 <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">{t('name')}</label>
                    <input type="text" className="w-full h-16 bg-white rounded-2xl px-6 font-bold border border-gray-100 focus:border-orange-500 outline-none transition-all" />
                 </div>
                 <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">{t('email')}</label>
                    <input type="email" className="w-full h-16 bg-white rounded-2xl px-6 font-bold border border-gray-100 focus:border-orange-500 outline-none transition-all" />
                 </div>
                 <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">{t('message')}</label>
                    <textarea rows={4} className="w-full bg-white rounded-2xl px-6 py-4 font-bold border border-gray-100 focus:border-orange-500 outline-none transition-all resize-none"></textarea>
                 </div>
                 <button className="w-full h-16 bg-gray-900 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-orange-600 transition-all shadow-xl shadow-gray-200">
                    {t('send')}
                    <Send size={18} />
                 </button>
              </form>
           </div>

           {/* Contact Channels */}
           <div className="flex flex-col gap-10 order-1 md:order-2 py-6">
              <div className="flex items-start gap-6 group">
                 <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-orange-100/50">
                    <MessageCircle size={28} />
                 </div>
                 <div>
                    <h4 className="text-lg font-black text-gray-900 mb-1">WhatsApp Destek</h4>
                    <p className="font-bold text-gray-400 text-sm mb-2">Saniyeler içinde yan yanıt veriyoruz.</p>
                    <a href="#" className="text-orange-600 font-black text-xs uppercase tracking-widest underline decoration-2 underline-offset-4 decoration-orange-200">SOHBETE BAŞLA</a>
                 </div>
              </div>

              <div className="flex items-start gap-6 group">
                 <div className="w-14 h-14 bg-gray-900 text-white rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Mail size={28} />
                 </div>
                 <div>
                    <h4 className="text-lg font-black text-gray-900 mb-1">E-posta</h4>
                    <p className="font-bold text-gray-400 text-sm mb-2">Genel sorular ve esnaf başvuruları.</p>
                    <a href="mailto:destek@emanetci.tr" className="text-gray-400 font-black text-xs uppercase tracking-widest underline decoration-2 underline-offset-4 decoration-gray-100">destek@emanetci.tr</a>
                 </div>
              </div>

              <div className="flex items-start gap-6 group">
                 <div className="w-14 h-14 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <MapPin size={28} />
                 </div>
                 <div>
                    <h4 className="text-lg font-black text-gray-900 mb-1">Operasyon Üssü</h4>
                    <p className="font-bold text-gray-400 text-sm mb-2">Beyoğlu, İstanbul / Türkiye</p>
                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest leading-none">MERKEZ OFİS</p>
                 </div>
              </div>
           </div>

        </div>
      </div>
    </div>
  );
}
