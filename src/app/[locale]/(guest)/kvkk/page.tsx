import { setRequestLocale, getTranslations } from "next-intl/server";
import { Scale, Fingerprint, Database, UserCheck } from "lucide-react";

export default async function KVKKPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Footer");

  return (
    <div className="min-h-screen bg-white font-sans pt-32 pb-20 px-6">
      <div className="max-w-3xl mx-auto">
        
        <header className="mb-16">
           <div className="w-16 h-16 bg-gray-50 text-gray-900 rounded-[1.5rem] flex items-center justify-center mb-6">
              <Fingerprint size={32} />
           </div>
           <h1 className="text-4xl font-black tracking-tighter text-gray-900 mb-4">{t('kvkk')}</h1>
           <p className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-none">6698 Sayılı Kanun Uyarınca</p>
        </header>

        <article className="prose prose-gray max-w-none flex flex-col gap-10 font-bold text-gray-500 leading-relaxed">
           
           <section>
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <UserCheck size={20} className="text-orange-600" />
                Veri Sorumlusu
              </h2>
              <p>
                Emanetçi Teknoloji A.Ş. olarak, 6698 Sayılı Kişisel Verilerin Korunması Kanunu uyarınca verilerinizin &quot;Veri Sorumlusu&quot; sıfatıyla işlenmesini taahhüt ediyoruz.
              </p>
           </section>

           <section className="bg-gray-900 text-white p-10 rounded-[3rem] shadow-2xl shadow-gray-200">
              <h2 className="text-xl font-black mb-6 flex items-center gap-3 text-white">
                <Database size={20} className="text-orange-500" />
                İşleme Amaçları
              </h2>
              <ul className="grid grid-cols-1 gap-4 list-none p-0">
                 {[
                   "Hizmetin ifası ve rezervasyon yönetimi",
                   "iyzico Üzerinden ödemelerin güvenli gerçekleştirilmesi",
                   "Kullanıcıya bildirim ve duyuruların iletilmesi",
                   "Yasal yükümlülüklerin yerine getirilmesi"
                 ].map((item, i) => (
                   <li key={i} className="bg-white/10 p-4 rounded-xl text-xs font-bold opacity-60 flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                     {item}
                   </li>
                 ))}
              </ul>
           </section>

           <section>
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <Scale size={20} className="text-orange-600" />
                Haklarınız
              </h2>
              <p>
                KVKK 11. Maddesi uyarınca; verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme ve eksik/yanlış verilerin düzeltilmesini isteme hakkına sahipsiniz. Başvurularınızı kvkk@emanetci.tr adresine iletebilirsiniz.
              </p>
           </section>

        </article>
      </div>
    </div>
  );
}
