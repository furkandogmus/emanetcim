import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/routing";
import { CalendarDays, ChevronRight, CircleHelp, MapPin, Shield, UserRound } from "lucide-react";
import ReferralCodeCard from "@/components/account/ReferralCodeCard";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/${locale}/login?callbackUrl=/${locale}/account`);
  }

  /**
   * `actions/booking.ts` ve `actions/referral.ts`'nin indirimi uyguladığı TEK
   * kaynak — `NEXT_PUBLIC_REFERRAL_DISCOUNT_PCT` diye ayrı bir istemci-tarafı
   * env var kullanılmıyor artık: ikisi senkron kalmayabiliyordu (bkz.
   * docs/KOD_TARAMA_2026-08-23.md, BULGU 15).
   */
  const discountPct = String(
    Math.min(50, Math.max(0, Number(process.env.REFERRAL_DISCOUNT_PCT ?? "5"))),
  );

  const copy =
    locale === "tr"
      ? {
          title: "Hesabım",
          hello: "Merhaba",
          subtitle: "Rezervasyonlarını ve hesap tercihlerini tek yerden yönet.",
          bookings: "Rezervasyonlarım",
          bookingsDesc: "Yaklaşan ve geçmiş emanetlerini görüntüle",
          explore: "Yeni emanet noktası bul",
          exploreDesc: "Yakınındaki güvenli noktaları keşfet",
          support: "Yardım ve destek",
          supportDesc: "Soruların için ekibimize ulaş",
          privacy: "Gizlilik ve veri",
          privacyDesc: "Hesap güvenliği ve veri tercihleri",
          profile: "Profil",
          referralTitle: `Arkadaşını Davet Et, İndirim Kazandır`,
          referralBody: `Referans kodunu arkadaşınla paylaş. İlk rezervasyonunda %${discountPct} indirim alır.`,
          referralReveal: "Referans Kodumu Göster",
          referralLoading: "Yükleniyor...",
          referralCopyTitle: "Linki kopyala",
        }
      : {
          title: "My Account",
          hello: "Hello",
          subtitle: "Manage your bookings and account preferences in one place.",
          bookings: "My Bookings",
          bookingsDesc: "View upcoming and previous storage bookings",
          explore: "Find a storage point",
          exploreDesc: "Discover secure locations near you",
          support: "Help and support",
          supportDesc: "Contact our team with your questions",
          privacy: "Privacy and data",
          privacyDesc: "Account security and data preferences",
          profile: "Profile",
          referralTitle: `Invite a Friend, They Get ${discountPct}% Off`,
          referralBody: `Share your referral code with a friend. They get ${discountPct}% off their first booking.`,
          referralReveal: "Show My Referral Code",
          referralLoading: "Loading...",
          referralCopyTitle: "Copy link",
        };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="border-b border-gray-100 bg-white px-6 py-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">{copy.profile}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900">{copy.title}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {copy.hello}{session.user.name ? `, ${session.user.name}` : ""}. {copy.subtitle}
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-5 p-4 sm:p-6 md:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-4">
          <Link href="/bookings" className="group flex items-center gap-4 rounded-3xl bg-gray-900 p-6 text-white shadow-xl transition-transform hover:-translate-y-0.5">
            <span className="rounded-2xl bg-white/10 p-3"><CalendarDays size={24} /></span>
            <span>
              <span className="block text-lg font-black">{copy.bookings}</span>
              <span className="block text-sm text-white/60">{copy.bookingsDesc}</span>
            </span>
            <ChevronRight size={18} className="ml-auto text-white/50 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href="/search" className="group flex items-center gap-4 rounded-3xl border border-orange-100 bg-orange-50 p-6 text-orange-950 transition-transform hover:-translate-y-0.5">
            <span className="rounded-2xl bg-white p-3 text-orange-600"><MapPin size={24} /></span>
            <span>
              <span className="block text-lg font-black">{copy.explore}</span>
              <span className="block text-sm text-orange-900/60">{copy.exploreDesc}</span>
            </span>
            <ChevronRight size={18} className="ml-auto text-orange-400 transition-transform group-hover:translate-x-1" />
          </Link>
          <ReferralCodeCard
            locale={locale}
            title={copy.referralTitle}
            body={copy.referralBody}
            revealLabel={copy.referralReveal}
            loadingLabel={copy.referralLoading}
            copyTitle={copy.referralCopyTitle}
          />
        </section>

        <nav className="h-fit divide-y divide-gray-50 rounded-3xl border border-gray-100 bg-white shadow-sm">
          <Link
            href="/contact"
            className="flex items-center gap-3 px-5 py-5 hover:bg-gray-50 transition-colors"
          >
            <CircleHelp size={18} className="text-gray-400" />
            <span>
              <span className="block text-sm font-bold text-gray-800">{copy.support}</span>
              <span className="block text-xs text-gray-400">{copy.supportDesc}</span>
            </span>
            <ChevronRight size={16} className="ml-auto text-gray-300" />
          </Link>
          <Link
            href="/account/privacy"
            className="flex items-center gap-3 px-5 py-5 hover:bg-gray-50 transition-colors"
          >
            <Shield size={18} className="text-gray-400" />
            <span>
              <span className="block text-sm font-bold text-gray-800">{copy.privacy}</span>
              <span className="block text-xs text-gray-400">{copy.privacyDesc}</span>
            </span>
            <ChevronRight size={16} className="ml-auto text-gray-300" />
          </Link>
          <Link
            href="/bookings"
            className="flex items-center gap-3 px-5 py-5 hover:bg-gray-50 transition-colors"
          >
            <UserRound size={18} className="text-gray-400" />
            <span className="text-sm font-bold text-gray-800">{copy.bookings}</span>
            <ChevronRight size={16} className="ml-auto text-gray-300" />
          </Link>
        </nav>
      </main>
    </div>
  );
}
