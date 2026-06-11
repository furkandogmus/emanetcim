import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Clock, RefreshCw, CreditCard, ShieldCheck } from "lucide-react";
import { alternatesForPath } from "@/lib/seo-alternates";

const copy = {
  tr: {
    title: "İptal ve İade Politikası",
    subtitle:
      "Esnek iptal, şeffaf iade. Son dakika değişikliklerinde bile koruma altındasınız.",
    badge: "ESNEK İPTAL",
    heroTitle: "Endişesiz",
    heroTitle2: "İptal",
    tier1Title: "24 Saatten Fazla Kala",
    tier1Badge: "Tam İade",
    tier1Desc:
      "Check-in tarihinize 24 saatten fazla varsa, ödediğiniz tutarın tamamı kartınıza iade edilir.",
    tier2Title: "1-24 Saat Kala",
    tier2Badge: "Yarı İade",
    tier2Desc:
      "Check-in'e 1-24 saat kala iptallerde, ödediğiniz tutarın %50'si kartınıza iade edilir.",
    tier3Title: "1 Saatten Az Kala",
    tier3Badge: "Kredi",
    tier3Desc:
      "Check-in'e 1 saatten az kala iptallerde ücret iadesi yapılmaz, ancak tutar bir sonraki rezervasyonunuzda kullanabileceğiniz kredi olarak hesabınıza tanımlanır.",
    howToTitle: "Nasıl İptal Ederim?",
    howTo1: "Rezervasyonlarım sayfasına gidin",
    howTo2: "İptal etmek istediğiniz rezervasyonu bulun",
    howTo3: '"Rezervasyonu İptal Et" butonuna tıklayın',
    howTo4: "İptal onayı otomatik olarak gerçekleşir",
    noteTitle: "Önemli Not",
    noteBody:
      "İptal durumunda iade, ödeme yönteminize bağlı olarak 5-10 iş günü içinde hesabınıza yansır. Kredi tutarları 6 ay süreyle geçerlidir.",
    cta: "Rezervasyon Yap",
  },
  en: {
    title: "Cancellation & Refund Policy",
    subtitle:
      "Flexible cancellation, transparent refunds. Protected even with last-minute changes.",
    badge: "FLEXIBLE CANCEL",
    heroTitle: "Worry-Free",
    heroTitle2: "Cancellation",
    tier1Title: "More Than 24 Hours",
    tier1Badge: "Full Refund",
    tier1Desc:
      "If you cancel more than 24 hours before check-in, the full amount is refunded to your card.",
    tier2Title: "1-24 Hours Before",
    tier2Badge: "Partial Refund",
    tier2Desc:
      "Cancellations 1-24 hours before check-in receive a 50% refund to your card.",
    tier3Title: "Less Than 1 Hour",
    tier3Badge: "Credit",
    tier3Desc:
      "Cancellations under 1 hour before check-in are not refunded in cash, but the amount is added as credit for your next booking.",
    howToTitle: "How to Cancel?",
    howTo1: "Go to My Bookings page",
    howTo2: "Find the booking you want to cancel",
    howTo3: 'Click "Cancel Booking" button',
    howTo4: "Cancellation is confirmed automatically",
    noteTitle: "Important Note",
    noteBody:
      "Refunds are processed within 5-10 business days depending on your payment method. Credits are valid for 6 months.",
    cta: "Book Now",
  },
};

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const content = locale === "tr" ? copy.tr : copy.en;
  return {
    title: content.title,
    description: content.subtitle,
    alternates: alternatesForPath(locale, "/cancellation"),
    openGraph: {
      title: content.title,
      description: content.subtitle,
    },
  };
}

export default async function CancellationPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const content = locale === "tr" ? copy.tr : copy.en;

  const tiers = [
    {
      icon: ShieldCheck,
      color: "emerald",
      title: content.tier1Title,
      badge: content.tier1Badge,
      desc: content.tier1Desc,
    },
    {
      icon: RefreshCw,
      color: "amber",
      title: content.tier2Title,
      badge: content.tier2Badge,
      desc: content.tier2Desc,
    },
    {
      icon: CreditCard,
      color: "rose",
      title: content.tier3Title,
      badge: content.tier3Badge,
      desc: content.tier3Desc,
    },
  ];

  return (
    <main className="min-h-screen bg-gray-50">
      <section className="relative bg-gradient-to-br from-orange-500 via-orange-600 to-amber-700 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxIDAgNiAyLjY5IDYgNnMtMi42OSA2LTYgNi02LTIuNjktNi02IDIuNjktNiA2LTYiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA4Ii8+PC9nPjwvc3ZnPg==')] opacity-40" />
        <div className="relative max-w-4xl mx-auto px-6 py-20 text-center">
          <span className="inline-block rounded-full bg-white/20 px-4 py-1.5 text-xs font-black uppercase tracking-[0.15em] mb-4">
            {content.badge}
          </span>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
            {content.heroTitle}
            <br />
            <span className="text-amber-200">{content.heroTitle2}</span>
          </h1>
          <p className="mt-4 text-white/80 max-w-xl mx-auto text-lg">
            {content.subtitle}
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {tiers.map((tier) => (
            <div
              key={tier.title}
              className="bg-white rounded-3xl p-6 shadow-lg shadow-gray-200/50 border border-gray-100 flex flex-col items-center text-center"
            >
              <div
                className={`w-14 h-14 rounded-2xl bg-${tier.color}-100 flex items-center justify-center mb-4`}
              >
                <tier.icon
                  size={28}
                  className={`text-${tier.color}-600`}
                  strokeWidth={1.5}
                />
              </div>
              <span
                className={`inline-block rounded-full bg-${tier.color}-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-${tier.color}-700 mb-3`}
              >
                {tier.badge}
              </span>
              <h3 className="text-lg font-black text-gray-900 mb-2">
                {tier.title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {tier.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-lg shadow-gray-200/50 border border-gray-100 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
              <Clock size={20} className="text-orange-600" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-black text-gray-900">
              {content.howToTitle}
            </h2>
          </div>
          <ol className="space-y-4">
            {[content.howTo1, content.howTo2, content.howTo3, content.howTo4].map(
              (step, i) => (
                <li key={i} className="flex items-center gap-4">
                  <span className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 font-black text-sm flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-gray-700 font-medium">{step}</span>
                </li>
              )
            )}
          </ol>
        </div>

        <div className="bg-amber-50 rounded-3xl p-6 border border-amber-100 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-200 flex items-center justify-center shrink-0">
            <ShieldCheck size={20} className="text-amber-700" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="font-black text-gray-900 mb-1">
              {content.noteTitle}
            </h3>
            <p className="text-sm text-gray-600">{content.noteBody}</p>
          </div>
        </div>

        <div className="text-center mt-10">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-8 py-3.5 rounded-2xl font-black text-sm transition-all shadow-lg shadow-orange-200 hover:shadow-orange-300"
          >
            {content.cta}
          </Link>
        </div>
      </section>
    </main>
  );
}
