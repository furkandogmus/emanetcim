import type { PaymentCopyMode } from "@/lib/payment-copy";

/**
 * Kullanim kosullari metni. Turkce BAGLAYICI metindir (T.C. hukuku); Ingilizce
 * kolaylik cevirisidir ve sayfada bunu soyleyen bir not tasir. Turkce disindaki
 * her dil Ingilizce metni gorur: eskiden en/de/fr/fa/ja kullanicisi sozlesmeyi
 * Turkce goruyordu ve Play'deki "Terms of Service" baglantisi (en) okunamiyordu.
 * Metin degisirse IKI dil birlikte degisir; `terms-content.test.ts` bolum ve
 * madde sayilarinin esit kaldigini dogrular.
 */
export type TermsSection = { title: string; paragraphs: (string | string[])[] };

function turkishSections(companyLegalName: string, paymentMode: PaymentCopyMode): TermsSection[] {
  return [
    {
      title: "1. TARAFLARIN TANIMLANMASI",
      paragraphs: [
        // Unvan verilmediginde bu paragraf hic cizilmez -- bkz. companyLegalName.
        ...(companyLegalName
          ? [
              `1.1. Şirket / Hizmet Sağlayıcı (BagajPark): İşbu sözleşmede; Ankara merkezli olarak faaliyet gösteren, bagaj depolama platformunun sahibi ve işletmecisi olan ${companyLegalName} (Bundan sonra kısaca "Şirket" veya "Platform" olarak anılacaktır) ifade edilir.`,
            ]
          : []),
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
        "2.3. Sorumluluk Sınırları: Platform, eşyaları bizzat muhafaza eden taraf değil, muhafaza eden ile alanı birleştiren teknolojik altyapıdır. Eşyaların fiziksel güvenliğinden (sözleşmede belirtilen limitler dahilinde) mühürleme kurallarına uyulması şartıyla İş Ortağı ve Platformun bu şartlar kapsamındaki güvencesi sorumludur. Emanet kabul edilmeyen eşyaların (yanıcı, yasa dışı vb.) depolanması kesinlikle yasaktır.",
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
        // 4.5 / 8.2 / 10.3: bu uc cumle "ödeme yalnızca uygulama üzerinden kart ile"
        // diyordu; urun su an DUKKANDA TAHSILAT ile calisiyor, yani sozlesme kullaniciyi
        // yapamayacagi bir sey icin taahhut altina sokuyordu. Cancellation/FAQ/Partners
        // sayfalarindaki cozumun aynisi: metnin surumunu saglayicinin yetenegi secer,
        // PSP baglandigi gun kartli surum kendiliginden geri gelir.
        paymentMode === "online"
          ? "4.5. Rezervasyon ve Ödeme Doğruluğu: Kullanıcı, ödemeleri yalnızca BagajPark uygulaması üzerinden yapacağını, İş Ortağına elden ödeme yapmayacağını kabul eder."
          : "4.5. Rezervasyon ve Ödeme Doğruluğu: Kullanıcı, hizmet bedelini bagajı teslim ederken İş Ortağının noktasında ödeyeceğini; Platform üzerinden yapılan rezervasyonun bu ödeme yükümlülüğünü ortadan kaldırmadığını kabul eder.",
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
        "6.1. Hizmetin Temel Amacı: BagajPark; kullanıcıların şahsi eşyalarını kısa süreli (gün bazında) olarak güvenli noktalarda muhafaza etmelerini sağlayan bir geçici depolama ve aracılık platformudur.",
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
        paymentMode === "online"
          ? "8.2. Ödeme Yöntemleri ve Güvenlik: Tüm ödemeler yalnızca Platform üzerinden kart ile yapılır. Ödemeler BDDK lisanslı güvenli aracılar üzerinden SSL şifreleme ile gerçekleştirilir; kart bilgileri BagajPark sunucularında saklanmaz."
          : "8.2. Ödeme Yöntemleri ve Güvenlik: Hizmet bedeli, bagajın teslimi sırasında doğrudan İş Ortağının noktasında tahsil edilir. Platform şu aşamada kart ile online tahsilat yapmaz; bu nedenle kart bilgisi ne istenir ne de saklanır.",
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
        "10.1. Rezervasyon İptali: Kullanıcı, check-in (teslim) saatine kadar rezervasyonunu istediği an ücretsiz iptal edebilir; ödenen tutarın tamamı iade edilir. Herhangi bir kesinti veya ceza uygulanmaz.",
        "10.2. Hizmet Kusuru: İş Ortağının kapalı olması veya mühür bulunmaması gibi durumlarda bildirim yapılması şartıyla tam iade yapılır.",
        paymentMode === "online"
          ? "10.3. İade Yöntemi: İadeler yalnızca ödeme yapılan karta 5-10 iş günü içinde yansıtılır."
          : "10.3. İade Yöntemi: Ödeme dükkanda tahsil edildiğinden, hizmet verilmeden iptal edilen rezervasyonlarda herhangi bir tahsilat yapılmaz; tahsil edilmiş bir bedelin iadesi ödemenin yapıldığı İş Ortağı noktasında gerçekleştirilir.",
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
}

function englishSections(companyLegalName: string, paymentMode: PaymentCopyMode): TermsSection[] {
  return [
    {
      title: "1. THE PARTIES",
      paragraphs: [
        ...(companyLegalName
          ? [
              `1.1. Company / Service Provider (BagajPark): ${companyLegalName}, based in Ankara, owner and operator of the luggage storage platform (hereinafter the "Company" or the "Platform").`,
            ]
          : []),
        '1.2. User (Traveller/Customer): any natural or legal person who books and pays through the Platform to leave luggage, parcels or personal belongings in storage (hereinafter the "User").',
        '1.3. Partner (Host/Storage Point): any business (shop, café, hotel, etc.) that, under a separate agreement with the Company, provides space on its premises to store Users\' belongings and is listed on the Platform (hereinafter the "Partner" or the "Point").',
      ],
    },
    {
      title: "2. SUBJECT AND SCOPE OF THE SERVICE",
      paragraphs: [
        "2.1. Subject: These terms set out the rules under which the User finds Partner points through the Platform, makes bookings and pays, in order to have their luggage and personal belongings stored temporarily.",
        "2.2. Scope of the service: BagajPark is an intermediary platform that:",
        [
          "lets Users view storage points and make bookings online;",
          "manages the securing of luggage at drop-off with tamper-evident BagajPark Security Seals;",
          "handles the secure collection of the service fee and settlement with the Partner;",
          "provides customer support for any problem that arises during a booking.",
        ],
        "2.3. Limits of responsibility: the Platform does not store belongings itself; it is the technology that connects the party storing them with the space. Provided the sealing rules are followed, the Partner and the Platform's guarantee under these terms are responsible for the physical safety of the belongings, within the limits stated in these terms. Storing items that are not accepted (flammable, illegal, etc.) is strictly prohibited.",
      ],
    },
    {
      title: "3. REGISTRATION AND ACCOUNT SECURITY",
      paragraphs: [
        "3.1. Registration: the User confirms that the information provided when signing up (such as email, name and phone number) is accurate and their own. Registration is completed with the verification code or link sent to the User's email address.",
        "3.2. Account security and password: the User must keep their password confidential and is responsible if it is obtained by a third party. The User must notify BagajPark support as soon as they notice any unauthorised use.",
        "3.3. Conditions and restrictions: each User may open only one account. Users must be at least 18 years old to use the service. Accounts are personal and cannot be transferred.",
        "3.4. Suspension and deletion: the Company may terminate an account unilaterally if these terms are breached. Even after an account is deleted, transaction data may be retained for the periods required by law.",
      ],
    },
    {
      title: "4. RIGHTS AND OBLIGATIONS OF THE USER",
      paragraphs: [
        "4.1. Contents of the luggage: the User accepts that the contents of the luggage they hand over comply with the laws of the Republic of Türkiye. The User is responsible for any illegal contents. Flammable or explosive items, perishable food and items that give off strong odours may not be handed over.",
        "4.2. Valuables: cash, jewellery, passports, antiques and other items of high material or sentimental value must not be left in luggage. Neither BagajPark nor the Partner can be held responsible for the loss of such items.",
        "4.3. Drop-off and sealing: when handing luggage to the Partner, the User must check that the BagajPark Security Seal has been attached correctly. The guarantee does not apply to luggage that is unsealed or incorrectly sealed.",
        "4.4. Timely pick-up and delays: the User must respect the Partner's opening hours. If the booking period is exceeded, the fee for the extra hours or days is charged automatically to the User's registered payment method.",
        paymentMode === "online"
          ? "4.5. Bookings and payment: the User agrees to pay only through the BagajPark app and not to pay the Partner in cash."
          : "4.5. Bookings and payment: the User agrees to pay the service fee at the Partner's point when handing over the luggage; a booking made through the Platform does not remove this payment obligation.",
      ],
    },
    {
      title: "5. RIGHTS OF THE PLATFORM (BAGAJPARK)",
      paragraphs: [
        "5.1. Inspection and security: where there is reasonable suspicion, or where public safety requires it, the Company or the Partner may inspect the contents or notify the authorities. The right to refuse suspicious luggage without giving a reason is reserved.",
        "5.2. Operational and technical measures: the Company may introduce additional sealing standards where needed for security, and may suspend the service temporarily for technical faults or maintenance.",
        "5.3. Pricing and payment: the Company may update prices and commissions, and may charge automatically when a booking period is exceeded.",
        "5.4. Content and data: the Company may moderate User reviews, remove offensive ones and close accounts without compensation if these terms are breached.",
        "5.5. Unclaimed belongings (right of retention): the Company has a right of retention over belongings that are not collected. It may dispose of belongings not collected after a set period or hand them over to the relevant authorities.",
      ],
    },
    {
      title: "6. PURPOSE OF THE PLATFORM",
      paragraphs: [
        "6.1. Main purpose: BagajPark is a temporary storage and intermediary platform that lets Users keep their personal belongings at safe points for short periods (by the day).",
        "6.2. Prohibited uses: the Platform must not be used as a commercial logistics warehouse, a parcel hand-over point (for example for courier deliveries) or to conceal illegal activity. Partner points may not be given as an official address for legal notices.",
        "6.3. Disclaimer: the User is personally responsible for any damage resulting from using the Platform for purposes other than those intended.",
      ],
    },
    {
      title: "7. COUPONS, DISCOUNTS AND PROMOTIONS",
      paragraphs: [
        "7.1. General conditions: unless stated otherwise, each discount code may be used only once (1) per User. Promotions cannot be exchanged for cash or transferred.",
        "7.2. Validity: expired coupons are invalid. Some promotions may be limited to certain cities or points.",
        "7.3. Cancellation: when a booking made with a discount is cancelled, the discount amount is not refunded in cash. Coupons issued as a result of a technical error may be cancelled by the Company.",
      ],
    },
    {
      title: "8. PAYMENT TERMS AND PRICING",
      paragraphs: [
        "8.1. Pricing: prices are set per bag, according to duration and size. The Company reserves the right to change prices.",
        paymentMode === "online"
          ? "8.2. Payment methods and security: all payments are made by card through the Platform only. Payments are processed by secure intermediaries licensed by the Turkish Banking Regulation and Supervision Agency (BDDK) using SSL encryption; card details are not stored on BagajPark servers."
          : "8.2. Payment methods and security: the service fee is collected directly at the Partner's point when the luggage is handed over. At this stage the Platform does not take card payments online, so card details are neither requested nor stored.",
        "8.3. Overstay and unused time: if the booking period is exceeded, the additional fee is charged automatically. No refund is given for unused time when luggage is collected early.",
        "8.4. Taxes and invoices: prices include statutory taxes. An e-archive invoice is sent to the User's email address.",
      ],
    },
    {
      title: "9. DROP-OFF AND PICK-UP PROCEDURE",
      paragraphs: [
        "9.1. Dropping off luggage: the User must show their digital QR code and the Partner must carry out the sealing. The User should check that the seal serial number has been recorded in the system. Photos of the luggage may be taken to record its condition.",
        '9.2. Picking up luggage: the User must have their "Pick-up Code" scanned. When collecting the luggage, the User must check that the seal has not been opened; claims made after the seal has been removed are not accepted.',
        "9.3. Third parties: for someone else to collect the luggage, they must be authorised through the app. The User is responsible for any risk arising from sharing the code.",
        "9.4. Forgotten belongings: a notification is sent for belongings not collected within 24 hours of the end of the booking. For belongings not collected within 15 days, the storage obligation ends and they may be transferred to the Company's head office.",
      ],
    },
    {
      title: "10. CANCELLATION AND REFUNDS",
      paragraphs: [
        "10.1. Cancelling a booking: the User may cancel a booking free of charge at any time up to the check-in (drop-off) time; the full amount paid is refunded. No deduction or penalty applies.",
        "10.2. Service failure: if the Partner is closed or no seal is available, a full refund is given provided the problem is reported.",
        paymentMode === "online"
          ? "10.3. Refund method: refunds are made only to the card used for payment, within 5 to 10 business days."
          : "10.3. Refund method: because payment is collected at the shop, nothing is charged for a booking cancelled before the service is provided; any amount already collected is refunded at the Partner's point where it was paid.",
        "10.4. Changes: any price difference arising from a change to a booking is charged; for changes to a lower price, the difference is not refunded (it may be credited as a wallet balance).",
      ],
    },
    {
      title: "11. INTELLECTUAL PROPERTY",
      paragraphs: [
        "11.1. Ownership: all rights to the software, design, text and logos on the Platform belong exclusively to the Company. Copying and reverse engineering are prohibited.",
        "11.2. User content: the Company holds a worldwide, perpetual licence to use reviews shared by Users.",
      ],
    },
    {
      title: "12. RECORD KEEPING AND EVIDENCE",
      paragraphs: [
        "12.1. Evidence agreement: the parties agree that, in any dispute, the system records in the BagajPark database and photos taken in the app constitute conclusive and exclusive evidence under the Turkish Code of Civil Procedure (HMK).",
        "12.2. Data retention: transaction records are kept for 10 years as required by law. The Company is obliged to share information in response to lawful requests from the authorities.",
      ],
    },
    {
      title: "13. FORCE MAJEURE",
      paragraphs: [
        "13.1. Definition and exemption: BagajPark cannot be held responsible for disruption of the service caused by events beyond its control, such as natural disasters, war, terrorism, epidemics or cyber attacks. The parties may not claim compensation from each other. If a force majeure event continues uninterrupted for 15 days, either party may terminate these terms without compensation.",
      ],
    },
    {
      title: "14. ENTRY INTO FORCE AND TERMINATION",
      paragraphs: [
        "14.1. Entry into force: these terms take effect when the User completes registration or uses the service.",
        "14.2. Termination: the User may terminate at any time by closing their account (provided they have no active booking). BagajPark may terminate without compensation and block access if these terms are breached.",
        "14.3. Jurisdiction: the courts and enforcement offices of ANKARA have jurisdiction over any dispute arising from these terms.",
      ],
    },
  ];
}

export type TermsLanguage = "tr" | "en";

export function termsLanguageFor(locale: string): TermsLanguage {
  return locale === "tr" ? "tr" : "en";
}

export const TERMS_COPY: Record<TermsLanguage, { title: string; notice: string | null }> = {
  tr: { title: "BagajPark Kullanım Koşulları ve Üyelik Sözleşmesi", notice: null },
  en: {
    title: "BagajPark Terms of Use and Membership Agreement",
    notice:
      "This English version is provided for convenience. The Turkish version is the legally binding text; in case of any discrepancy, the Turkish version prevails.",
  },
};

export function termsSections(
  language: TermsLanguage,
  opts: { companyLegalName: string; paymentMode: PaymentCopyMode },
): TermsSection[] {
  return language === "tr"
    ? turkishSections(opts.companyLegalName, opts.paymentMode)
    : englishSections(opts.companyLegalName, opts.paymentMode);
}
