import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/routing";
import { ChevronRight, Gift, Shield } from "lucide-react";
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

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white border-b border-gray-100 px-6 py-5">
        <h1 className="text-xl font-black tracking-tight text-gray-900">Hesabım</h1>
        {session.user.name && (
          <p className="text-sm text-gray-500 mt-0.5">Merhaba, {session.user.name}</p>
        )}
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4">
        {/* Referral Card */}
        <ReferralCodeCard />

        {/* Settings links */}
        <nav className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
          <Link
            href="/account/privacy"
            className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
          >
            <Shield size={18} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-800">Gizlilik ve Veri</span>
            <ChevronRight size={16} className="ml-auto text-gray-300" />
          </Link>
          <Link
            href="/bookings"
            className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
          >
            <Gift size={18} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-800">Rezervasyonlarım</span>
            <ChevronRight size={16} className="ml-auto text-gray-300" />
          </Link>
        </nav>
      </main>
    </div>
  );
}
