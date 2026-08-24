import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/routing";
import { CalendarDays, ChevronRight, CircleHelp, MapPin, Shield } from "lucide-react";
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

  const t = await getTranslations("Account");
  const copy = {
    title: t("title"),
    hello: t("hello"),
    subtitle: t("subtitle"),
    bookings: t("bookings"),
    bookingsDesc: t("bookingsDesc"),
    explore: t("explore"),
    exploreDesc: t("exploreDesc"),
    support: t("support"),
    supportDesc: t("supportDesc"),
    privacy: t("privacy"),
    privacyDesc: t("privacyDesc"),
    profile: t("profile"),
    referralTitle: t("referralTitle", { pct: discountPct }),
    referralBody: t("referralBody", { pct: discountPct }),
    referralReveal: t("referralReveal"),
    referralLoading: t("referralLoading"),
    referralCopyTitle: t("referralCopyTitle"),
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
        </nav>
      </main>
    </div>
  );
}
