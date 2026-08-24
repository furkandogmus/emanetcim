import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ChevronLeft } from "lucide-react";
import AccountPrivacyClient from "./AccountPrivacyClient";

export default async function AccountPrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("AccountPrivacy");

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 font-sans">
      <div className="mx-auto max-w-2xl">
        {/*
          Sayfaya UC farkli giris noktasi var: Hesabim (`/account`), header
          menusu (herhangi bir sayfa) ve Rezervasyonlarim (`/bookings`). Sabit
          `href="/bookings"` yalnizca ucuncusu icin dogruydu; digerlerinden
          gelen misafir "geri" derken beklemedigi bir sayfaya atiliyordu.
          `/account` gizlilik ayarlarinin kavramsal ebeveyni oldugu icin en
          tutarli varsayilan.
        */}
        <Link
          href="/account"
          className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-orange-600"
        >
          <ChevronLeft size={18} />
          {t("back")}
        </Link>
        <h1 className="text-3xl font-black tracking-tight text-gray-900">
          {t("pageTitle")}
        </h1>
        <p className="mt-2 text-sm text-gray-600">{t("pageIntro")}</p>
        <div className="mt-8">
          <AccountPrivacyClient />
        </div>
      </div>
    </div>
  );
}
