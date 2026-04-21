import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { alternatesForPath } from "@/lib/seo-alternates";
import { getGuestStaticSeo } from "@/lib/guest-static-seo";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { Gavel } from "lucide-react";
import { Link } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { title, description } = getGuestStaticSeo(locale, "terms");
  const base = getSiteBaseUrl();
  return {
    title,
    description,
    alternates: alternatesForPath(locale, "/terms"),
    openGraph: { title, description, url: `${base}/${locale}/terms` },
  };
}

type Section = { title: string; paragraphs: (string | string[])[] };

const SECTIONS: Section[] = [
  {
    title: "1. TARAFLARIN TANIMLANMASI",
    paragraphs: [
      "1.1. Şirket / Hizmet Sağlayıcı (BagajPark): İşbu sözleşmede; Ankara merkezli olarak faaliyet gösteren, bagaj depolama platformunun sahibi ve işletmecisi olan [Şirket Tam Ünvanı] (Bundan sonra kısaca \"Şirket\" veya \"Platform\" olarak anılacaktır) ifade edilir.",
      "1.2. Kullanıcı (Gezgin/Müşteri): Platform üzerinden bagaj, paket veya kişisel eşyalarını emanet etmek amacıyla rezervasyon yapan, ödeme gerçekleştiren gerçek veya tüzel kişileri (Bundan sonra kısaca \"Kullanıcı\" olarak anılacaktır) ifade edilir.",
      "1.3. İş Ortağı (Host/Depolama Noktası): Şirket ile yapılan ayrı bir sözleşme çerçevesinde; kendisine ait işletmede (dükkan, kafe, otel vb.) Kullanıcıların eşyalarını muhafaza etmek üzere alan tahsis eden ve Platformda ilan yayınlayan tarafları (Bundan sonra kısaca \"İş Ortağı\" veya \"Nokta\" olarak anılacaktır) ifade edilir.",
    ],
  },
  {
    title: "2. SÖZLEŞMENİN KONUSU VE HİZMET KAPSAMI",
    paragraphs: [
      "2.1. Sözleşmenin Konusu: İşbu sözleşmenin konusu; Kullanıcı'nın, kendisine ait bagaj ve kişisel eşyaları geçici süreyle muhafaza ettirmek amacıyla Platform üzerinden İş Ortağı noktalarını bulması, rezervasyon yapması ve ödeme süreçlerinin yönetilmesine ilişkin usul ve esasların belirlenmesidir.",
      "2.2. Hizmet Kapsamı: BagajPark, aşağıdaki hizmetleri sağlayan aracı bir platformdur:",
      [
        "Kullanıcıların depolama noktalarını görüntülemesini ve online rezervasyon oluşturmasını sağlar.",
        "Eşyaların teslimi sırasında, müdahale edilemez nitelikteki BagajPark Güvenlik Mühürleri ile bagajların emniyete alınması sürecini yönetir.",
        "Hizmet bedelinin güvenli tahsilatını ve İş Ortağı ile mahsuplaşma süreçlerini yürütür.",
        "Rezervasyon süresince ortaya çıkabilecek aksaklıklarda müşteri desteği sağlar.",
      ],
      "2.3. Sorumluluk Sınırları: Platform, eşyaları bizzat muhafaza eden taraf değil, muhafaza eden ile alanı birleştiren teknolojik altyapıdır. Eşyaların fiziksel güvenliğinden (sözleşmede belirtilen limitler dahilinde) mühürleme kurallarına uyulması şartıyla İş Ortağı ve ilgili sigorta/güvence kapsamı sorumludur. Emanet kabul edilmeyen eşyaların (yanıcı, yasa dışı vb.) depolanması kesinlikle yasaktır.",
    ],
  },
  {
    title: "3. KULLANICI KAYIT VE HESAP GÜVENLİĞİ",
    paragraphs: [
      "3.1. Kayıt ve Üyelik: Kullanıcı, Platform'a üye olurken sunduğu e-posta, isim, telefon gibi bilgilerin güncel ve kendisine ait olduğunu taahhüt eder. Kayıt işlemi, e-posta adresine gönderilen doğrulama kodu/linki ile tamamlanır.",
      "3.2. Hesap Güvenliği ve Şifre: Kullanıcı, oluşturduğu şifrenin gizliliğini korumakla yükümlüdür. Şifrenin üçüncü şahıslar tarafından ele geçirilmesi durumunda sorumluluk Kullanıcı'dadır. Kullanıcı, yetkisiz kullanımı fark ettiği anda BagajPark destek birimine bildirmelidir.",
      "3.3. Kullanım Şartları ve Kısıtlamalar: Her Kullanıcı yalnızca bir adet hesap açabilir. Hizmet alabilmek için Kullanıcı'nın en az 18 yaşında olması gerekmektedir. Kullanıcı hesapları kişiseldir ve devredilemez.",
      "3.4. Hesabın Askıya Alınması ve Silinmesi: Sözleşme ihlali durumunda Şirket hesabı tek taraflı feshetme yetkisine sahiptir. Hesap silinse dahi yasal yükümlülük gereği işlem verileri yasal sürelerce saklanabilir.",
    ],
  },
  {
    title: "4. KULLANICI'NIN HAK VE YÜKÜMLÜLÜKLERİ",
    paragraphs: [
      "4.1. Bagaj İçeriğine İlişkin Sorumluluk: Kullanıcı, teslim ettiği bagajın içeriğinin T.C. yasalarına uygun olduğunu kabul eder. Yasa dışı içeriklerden doğacak sorumluluk Kullanıcı'ya aittir. Yanıcı, patlayıcı, bozulabilir gıda veya kötü koku yayan nesnelerin teslimi yasaktır.",
      "4.2. Değerli Eşya Kısıtlaması: Nakit para, mücevher, pasaport, antika ve benzeri yüksek maddi/manevi değere sahip eşyaların bagaj içerisinde bırakılması yasaktır. Bu tür eşyaların kaybından BagajPark veya İş Ortağı sorumlu tutulamaz.",
      "4.3. Teslimat ve Mühürleme Süreci: Kullanıcı, bagajını İş Ortağına teslim ederken BagajPark Güvenlik Mührü'nün usulüne uygun takıldığını kontrol etmekle yükümlüdür. Mühürsüz veya hatalı mühürlenmiş bagajlar için sunulan güvence kapsamı geçersizdir.",
      "4.4. Zamanında Teslim Alma ve Gecikme: Kullanıcı, İş Ortağının çalışma saatlerine uymak zorundadır. Rezervasyon süresi aşıldığında, ek saat/gün bedeli Kullanıcı'nın kayıtlı ödeme yönteminden otomatik olarak tahsil edilir.",
      "4.5. Rezervasyon ve Ödeme Doğruluğu: Kullanıcı, ödemeleri yalnızca BagajPark uygulaması üzerinden yapacağını, İş Ortağına elden ödeme yapmayacağını kabul eder.",
    ],
  },
  {
    title: "5. PLATFORMA (BAGAJPARK) TANINAN YETKİ VE HAKLAR",
    paragraphs: [
      "5.1. Denetim ve Güvenlik Yetkisi: Şirket veya İş Ortağı, makul bir şüphe durumunda veya kamu güvenliği gerektirdiğinde içeriği kontrol etme veya resmi makamlara bildirme yetkisine sahiptir. Şüpheli bagajları gerekçe göstermeksizin reddetme hakkı saklıdır.",
      "5.2. Operasyonel ve Teknik Müdahale: Güvenlik için gerekli görüldüğünde ek mühürleme standartları getirme yetkisine sahiptir. Teknik arıza veya bakım durumunda hizmeti geçici durdurabilir.",
      "5.3. Fiyatlandırma ve Ödeme Yetkisi: Şirket fiyatları ve komisyonları güncelleme hakkına sahiptir. Süre aşımı durumunda otomatik tahsilat yetkisine sahiptir.",
      "5.4. İçerik ve Veri Yönetimi: Kullanıcı yorumlarını denetleme, hakaret içerenleri silme ve sözleşme ihlali durumunda hesapları tazminatsız kapatma yetkisi Şirket'tedir.",
      "5.5. Eşyaların Tasfiyesi (Rehin Hakkı): Teslim alınmayan eşyalar üzerinde Şirket'in hapis (alıkoyma) hakkı vardır. Belirli süreyi aşan ve alınmayan eşyaları tasfiye etme veya ilgili birimlere devretme yetkisine sahiptir.",
    ],
  },
  {
    title: "6. PLATFORMUN KULLANIM AMACI",
    paragraphs: [
      "6.1. Hizmetin Temel Amacı: BagajPark; kullanıcıların şahsi eşyalarını kısa süreli (saatlik veya günlük) olarak güvenli noktalarda muhafaza etmelerini sağlayan bir geçici depolama ve aracılık platformudur.",
      "6.2. Yasaklı Kullanım Amaçları: Platformun ticari lojistik ambarı, kargo transfer noktası (kurye teslimatı gibi) veya yasa dışı faaliyetlerin gizlenmesi amacıyla kullanılması yasaktır. İş Ortağı noktaları resmi tebligat adresi olarak gösterilemez.",
      "6.3. Sorumluluk Reddi: Platformun kullanım amacının dışına çıkarılması sonucu doğacak zararlardan Kullanıcı bizzat sorumludur.",
    ],
  },
  {
    title: "7. KUPON, İNDİRİM VE PROMOSYONLAR",
    paragraphs: [
      "7.1. Genel Koşullar: Her indirim kodu aksi belirtilmedikçe her Kullanıcı tarafından yalnızca bir (1) kez kullanılabilir. Promosyonlar nakde çevrilemez ve devredilemez.",
      "7.2. Süre ve Geçerlilik: Süresi dolan kuponlar geçersizdir. Bazı promosyonlar yalnızca belirli şehir veya noktalarla sınırlandırılabilir.",
      "7.3. İptal Durumunda: İndirimle yapılan rezervasyon iptal edildiğinde indirim tutarı nakit iade edilmez. Teknik hata sonucu tanımlanan kuponlar Şirketçe iptal edilebilir.",
    ],
  },
  {
    title: "8. ÖDEME KOŞULLARI VE ÜCRETLENDİRME",
    paragraphs: [
      "8.1. Ücretlendirme Esasları: Ücretler bagaj başına, zamana ve boyuta göre belirlenir. Şirket fiyatlarda değişiklik yapma hakkını saklı tutar.",
      "8.2. Ödeme Yöntemleri ve Güvenlik: Tüm ödemeler yalnızca Platform üzerinden kart ile yapılır. Ödemeler BDDK lisanslı güvenli aracılar üzerinden SSL şifreleme ile gerçekleştirilir; kart bilgileri BagajPark sunucularında saklanmaz.",
      "8.3. Süre Aşımı ve Eksik Kullanım: Rezervasyon süresi aşılırsa ek ücret otomatik tahsil edilir. Erken teslim alımlarda kullanılmayan süre için iade yapılmaz.",
      "8.4. Vergi ve Fatura: Ücretlere yasal vergiler dahildir. E-arşiv fatura kullanıcının e-posta adresine iletilir.",
    ],
  },
  {
    title: "9. ÜRÜN TESLİM ALMA VE TESLİM ETME PROSEDÜRÜ",
    paragraphs: [
      "9.1. Bagajın Teslim Edilmesi: Kullanıcı dijital QR kodunu göstermeli ve İş Ortağı mühürleme işlemini gerçekleştirmelidir. Mühür seri numarasının sisteme işlendiği kontrol edilmelidir. Durum tespiti için bagaj fotoğrafları çekilebilir.",
      "9.2. Bagajın Teslim Alınması: Kullanıcı \"Teslim Alma Kodunu\" okutmak zorundadır. Bagaj teslim alınırken mührün açılmadığı kontrol edilmelidir; mühür söküldükten sonra yapılacak ihbarlar kabul edilmez.",
      "9.3. Üçüncü Şahıslar: Bagajın başkası tarafından alınması için uygulama üzerinden yetkilendirme yapılmalıdır. Kodun paylaşılması sonucu doğacak risklerden Kullanıcı sorumludur.",
      "9.4. Unutulan Eşyalar: Rezervasyon bitiminden itibaren 24 saat içinde alınmayan eşyalar için bildirim gönderilir. 15 gün içinde alınmayan eşyalar üzerinde depolama yükümlülüğü sona erer ve Şirket merkezine transfer edilebilir.",
    ],
  },
  {
    title: "10. İPTAL VE ÜCRET İADESİ KOŞULLARI",
    paragraphs: [
      "10.1. Rezervasyon İptali: Rezervasyon saatinden 24 saat öncesine kadar tam iade yapılır. Rezervasyon saatine 2 saatten az kala yapılan iptallerde tutarın %50'si kesilerek iade edilir. Rezervasyon saati geçtikten sonra iade yapılmaz.",
      "10.2. Hizmet Kusuru: İş Ortağının kapalı olması veya mühür bulunmaması gibi durumlarda bildirim yapılması şartıyla tam iade yapılır.",
      "10.3. İade Yöntemi: İadeler yalnızca ödeme yapılan karta 3-10 iş günü içinde yansıtılır.",
      "10.4. Değişiklik: Rezervasyon değişikliklerinde oluşacak fiyat farkları tahsil edilir; daha düşük fiyatlı değişikliklerde fark iade edilmez (cüzdan bakiyesi olarak tanımlanabilir).",
    ],
  },
  {
    title: "11. FİKRİ MÜLKİYET HAKLARI",
    paragraphs: [
      "11.1. Mülkiyetin Aidiyeti: Platform içerisindeki yazılım, tasarım, metin ve logoların mülkiyet hakları münhasıran Şirket'e aittir. Kopyalanması, tersine mühendislik yapılması yasaktır.",
      "11.2. İçerik: Kullanıcıların paylaştığı yorumlar üzerinde Şirket, dünya çapında ve süresiz kullanım lisansına sahiptir.",
    ],
  },
  {
    title: "12. BİLGİLERİN SAKLANMASI VE İSPAT YÜKÜMLÜLÜĞÜ",
    paragraphs: [
      "12.1. Delil Sözleşmesi: Taraflar, uyuşmazlıklarda BagajPark veri tabanındaki sistem kayıtlarının ve uygulama içi fotoğrafların HMK uyarınca kesin ve münhasır delil sayılacağını kabul ederler.",
      "12.2. Veri Saklama: İşlem kayıtları yasal mevzuat gereği 10 yıl süreyle saklanır. Şirket, resmi makamların yasal talepleri doğrultusunda bilgi paylaşmakla yükümlüdür.",
    ],
  },
  {
    title: "13. MÜCBİR SEBEPLER",
    paragraphs: [
      "13.1. Tanım ve Sorumsuzluk: Doğal afet, savaş, terör, salgın hastalık veya siber saldırı gibi kontrol dışı durumlarda hizmetin aksamasından dolayı BagajPark sorumlu tutulamaz. Taraflar birbirlerinden tazminat talep edemezler. Mücbir sebep hali 15 gün kesintisiz sürerse taraflar sözleşmeyi tazminatsız feshedebilir.",
    ],
  },
  {
    title: "14. YÜRÜRLÜK VE FESİH",
    paragraphs: [
      "14.1. Yürürlük: Sözleşme, Kullanıcı'nın kayıt işlemini tamamlaması veya hizmeti kullanmasıyla yürürlüğe girer.",
      "14.2. Fesih: Kullanıcı dilediği zaman hesabını kapatarak fesih yapabilir (aktif rezervasyonu yoksa). BagajPark, sözleşme ihlali durumunda tazminatsız fesih ve erişim engelleme hakkına sahiptir.",
      "14.3. Yetkili Mahkemeler: Sözleşmeden doğan uyuşmazlıklarda ANKARA MAHKEMELERİ VE İCRA DAİRELERİ yetkilidir.",
    ],
  },
];

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Terms");

  return (
    <div className="min-h-screen bg-white">
      <header className="py-24 px-6 bg-orange-600 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-orange-700 to-orange-500" />
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-white mb-8 border border-white/20">
            <Gavel size={32} />
          </div>
          <h1 className="text-5xl font-black tracking-tighter mb-4">
            BagajPark Kullanım Koşulları ve Üyelik Sözleşmesi
          </h1>
          <p className="text-orange-100 font-bold text-lg">
            {t("lastUpdated")}
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-16 px-6">
        <div className="space-y-12">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-black text-gray-900 mb-4 border-l-4 border-orange-600 pl-4">
                {section.title}
              </h2>
              <div className="space-y-4 text-gray-700 font-medium leading-relaxed">
                {section.paragraphs.map((p, i) =>
                  Array.isArray(p) ? (
                    <ul key={i} className="list-disc pl-6 space-y-2">
                      {p.map((item, j) => (
                        <li key={j}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p key={i}>{p}</p>
                  )
                )}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-20 pt-10 border-t border-gray-100 text-center">
          <p className="text-gray-400 font-bold text-sm">
            {t("footerQuestion")}{" "}
            <Link href="/contact" className="text-orange-600 hover:underline">
              {t("footerContact")}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
