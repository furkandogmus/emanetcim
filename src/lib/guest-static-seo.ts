/**
 * Misafir statik sayfalar: TR odaklı meta; diğer diller için EN yedek.
 * (Tüm locale JSON dosyalarına meta anahtarı eklemek yerine.)
 */
export type GuestStaticSeoKey =
  | "about"
  | "contact"
  | "faq"
  | "partners"
  | "privacy"
  | "terms"
  | "kvkk"
  | "login"
  | "register";

const TR: Record<GuestStaticSeoKey, { title: string; description: string }> = {
  about: {
    title: "Hakkımızda | BagajPark",
    description:
      "BagajPark nedir? Yerel esnaf ağıyla Türkiye’de güvenli valiz emanet ve bagaj bırakma. Misyonumuz, şehri valizensiz keşfetmenizi sağlamak.",
  },
  contact: {
    title: "İletişim | BagajPark",
    description:
      "BagajPark destek: sorularınız, rezervasyon ve operasyon için WhatsApp ve e-posta. 7/24 yanınızdayız.",
  },
  faq: {
    title: "Sıkça Sorulan Sorular | BagajPark",
    description:
      "Valiz emanet, iptal-iade, ödeme, mühürleme ve güvence hakkında SSS. BagajPark ile güvenli bagaj saklama.",
  },
  partners: {
    title: "Esnaf Ortaklığı | BagajPark",
    description:
      "Dükkanınızı valiz emanet noktası yapın; ek gelir ve dijital rezervasyon. BagajPark ortaklık modeli ve başvuru.",
  },
  privacy: {
    title: "Gizlilik Politikası | BagajPark",
    description:
      "Kişisel verilerinizin işlenmesi, çerezler ve paylaşım. BagajPark gizlilik taahhüdü.",
  },
  terms: {
    title: "Kullanım Koşulları | BagajPark",
    description:
      "BagajPark platform kullanım şartları, sorumluluk, iptal ve mühürleme kuralları.",
  },
  kvkk: {
    title: "KVKK Aydınlatma Metni | BagajPark",
    description:
      "6698 sayılı KVKK kapsamında veri işleme, haklarınız ve iletişim. BagajPark aydınlatma metni.",
  },
  login: {
    title: "Giriş Yap | BagajPark",
    description:
      "Misafir veya esnaf hesabınızla BagajPark’a giriş yapın; rezervasyon ve panel erişimi.",
  },
  register: {
    title: "Kayıt Ol | BagajPark",
    description:
      "Gezgin olarak ücretsiz kayıt; yakınınızdaki emanet noktalarını bulun ve güvenle valiz bırakın.",
  },
};

const EN: Record<GuestStaticSeoKey, { title: string; description: string }> = {
  about: {
    title: "About Us | BagajPark",
    description:
      "BagajPark connects travelers with local shops for secure luggage storage across Turkey. Our mission: explore cities bag-free.",
  },
  contact: {
    title: "Contact | BagajPark",
    description:
      "Reach BagajPark support via WhatsApp or email for bookings, partners, and operations. We are here to help.",
  },
  faq: {
    title: "FAQ | BagajPark",
    description:
      "Answers about luggage storage, cancellations, refunds, payments, sealing, and coverage. BagajPark guest FAQ.",
  },
  partners: {
    title: "Partner With Us | BagajPark",
    description:
      "Turn your shop into a luggage drop-off point. Extra revenue and digital bookings with the BagajPark partner program.",
  },
  privacy: {
    title: "Privacy Policy | BagajPark",
    description:
      "How BagajPark processes personal data, cookies, and sharing. Our privacy commitment.",
  },
  terms: {
    title: "Terms of Use | BagajPark",
    description:
      "BagajPark platform terms, liability, cancellation rules, and sealing requirements.",
  },
  kvkk: {
    title: "Privacy Notice (KVKK) | BagajPark",
    description:
      "Turkey KVKK disclosure: data processing, your rights, and how to contact BagajPark.",
  },
  login: {
    title: "Sign In | BagajPark",
    description:
      "Sign in to BagajPark as a guest or partner for bookings and dashboard access.",
  },
  register: {
    title: "Create Account | BagajPark",
    description:
      "Register as a guest to find nearby luggage storage and book secure bag drop-off in Turkey.",
  },
};

export function getGuestStaticSeo(
  locale: string,
  key: GuestStaticSeoKey,
): { title: string; description: string } {
  // BUG-20: Diğer 12 dil için EN fallback
  const set = locale === "tr" ? TR : EN;
  const result = set[key];
  
  if (result) return result;
  
  // Eğer dilde anahtar yoksa (örn: yeni eklenen bir sayfa) her zaman EN'e dön
  return EN[key];
}
