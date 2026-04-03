import { setRequestLocale, getTranslations } from "next-intl/server";
import { Lock, Eye, Cookie, ShieldCheck } from "lucide-react";

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Footer");

  return (
    <div className="min-h-screen bg-white font-sans pt-32 pb-20 px-6">
      <div className="max-w-3xl mx-auto">
        
        <header className="mb-16">
           <div className="w-16 h-16 bg-gray-50 text-gray-900 rounded-[1.5rem] flex items-center justify-center mb-6">
              <Lock size={32} />
           </div>
           <h1 className="text-4xl font-black tracking-tighter text-gray-900 mb-4">{t('privacy')}</h1>
           <p className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-none">Son Güncelleme: 03.04.2024</p>
        </header>

        <article className="prose prose-gray max-w-none flex flex-col gap-10 font-bold text-gray-500 leading-relaxed">
           
           <section>
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <ShieldCheck size={20} className="text-green-500" />
                Gizlilik Taahhüdümüz
              </h2>
              <p>
                Emanetçi olarak, kişisel verilerinizin güvenliğini her şeyin üstünde tutuyoruz. Platformumuzu kullanırken paylaştığınız her türlü bilgi, en yüksek şifreleme yöntemleriyle (AES-256) korunmaktadır.
              </p>
           </section>

           <section className="bg-gray-50 p-10 rounded-[3rem] border border-gray-100">
              <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-3">
                <Eye size={20} className="text-orange-600" />
                Hangi Verileri Topluyoruz?
              </h2>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 list-none p-0">
                 {[
                   "Telefon Numarası (Sms Onayı İçin)",
                   "Konum Verisi (Yakındaki Esnafları Bulmak İçin)",
                   "Kredi Kartı Maskeli Bilgisi (iyzico Aracılığıyla)",
                   "Emanet Teslimat Fotoğrafları (Mühür Onayı İçin)"
                 ].map((item, i) => (
                   <li key={i} className="bg-white p-4 rounded-xl text-xs font-bold text-gray-400 flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                     {item}
                   </li>
                 ))}
              </ul>
           </section>

           <section>
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <Cookie size={20} className="text-orange-600" />
                Çerezler ve Takip Teknolojileri
              </h2>
              <p>
                Platformun sorunsuz çalışması, oturum yönetimi ve size en uygun emanet noktalarını önerebilmemiz için zorunlu çerezler kullanıyoruz. Ayrıca deneyiminizi iyileştirmek için anonim analitik çerezlerden faydalanıyoruz.
              </p>
           </section>

        </article>
      </div>
    </div>
  );
}
